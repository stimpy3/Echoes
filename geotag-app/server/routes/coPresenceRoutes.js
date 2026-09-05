const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { coPresenceActionLimiter } = require('../middleware/rateLimiter');
const { isCoPresenceEnabled } = require('../utils/featureFlags');
const CoPresenceCandidate = require('../models/coPresenceCandidate');
const CoPresenceMatch = require('../models/coPresenceMatch');

/*
Co-presence rollout, Phase 6 kill switch. Checked before verifyToken on every route in
this file — an emergency rollback should not require a valid session to take effect,
and 503 here reveals nothing about any specific candidate's existence (unlike 403/404,
which are per-resource), so it's safe to return before authentication runs at all.
Flipping COPRESENCE_ENABLED=false stops every route below immediately, with no deploy
required; existing opt-in flags, pending candidates, and confirmed matches are
untouched — this only blocks NEW activity through this API while it's off.
*/
router.use((req, res, next) => {
  if (!isCoPresenceEnabled()) {
    return res.status(503).json({ message: 'Co-presence is currently unavailable' });
  }
  next();
});

/*
Co-presence rollout, Phase 4 — the highest-scrutiny phase in the rollout plan, and the
first one with a live, reachable API surface for this feature at all. The one rule
every handler below exists to serve, with zero exceptions: a match is only ever visible
to either party after BOTH have confirmed, and confirming alone must never let the
other party learn anything — not that a candidate exists, not that the other side has
already acted.

That's enforced structurally, not just by convention: /pending's response shape only
ever includes a `myConfirmed` boolean (derived from the caller's own side of the
candidate), never the raw `status` string — exposing the raw status would leak WHICH
side confirmed (e.g. 'confirmedByA' tells B that A specifically has acted). And any
route that answers "who am I matched with" reads exclusively from CoPresenceMatch
(models/coPresenceMatch.js), never CoPresenceCandidate — so a future bug in a listing
query can't accidentally surface a one-sided or rejected candidate; the collection it
would have to query simply doesn't contain one.
*/

const MEMORY_PREVIEW_FIELDS = 'title photoUrl location createdAt';
const USER_PREVIEW_FIELDS = 'name profilePic';

function otherSide(doc, userId) {
  return doc.userA._id.toString() === userId ? doc.userB : doc.userA;
}

function mySide(doc, userId, aField, bField) {
  return doc.userA._id.toString() === userId ? doc[aField] : doc[bField];
}

// Every candidate this caller is part of that hasn't reached 'matched' yet. Scoped to
// the caller's own rows via the query itself — there is no :id here to probe, so this
// route isn't rate-limited the way confirm/reject are.
router.get('/pending', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const candidates = await CoPresenceCandidate.find({
      $or: [{ userA: userId }, { userB: userId }],
      status: { $ne: 'matched' },
    })
      .populate('userA', USER_PREVIEW_FIELDS)
      .populate('userB', USER_PREVIEW_FIELDS)
      .populate('memoryA', MEMORY_PREVIEW_FIELDS)
      .populate('memoryB', MEMORY_PREVIEW_FIELDS)
      .sort({ createdAt: -1 });

    const shaped = candidates.map((c) => {
      const iAmA = c.userA._id.toString() === userId;
      // Deliberately the ONLY confirmation-state field in this response. Never expose
      // c.status directly here — 'confirmedByA' vs 'confirmedByB' would tell whichever
      // user isn't A/B-the-confirmer that the OTHER specific person has already acted,
      // which is exactly the leak this phase exists to prevent.
      const myConfirmed = iAmA ? c.status === 'confirmedByA' : c.status === 'confirmedByB';

      return {
        _id: c._id,
        otherUser: otherSide(c, userId),
        myMemory: mySide(c, userId, 'memoryA', 'memoryB'),
        otherMemory: mySide(c, userId, 'memoryB', 'memoryA'),
        distanceMeters: c.distanceMeters,
        timeDeltaMinutes: c.timeDeltaMinutes,
        myConfirmed,
      };
    });

    res.json(shaped);
  } catch (err) {
    req.log.error({ err }, '[co-presence] error fetching pending candidates');
    res.status(500).json({ message: 'Server error' });
  }
});

// Confirmed, mutually-visible co-presence events. Reads ONLY from CoPresenceMatch —
// see this file's header comment for why that's a hard rule, not a convenience.
router.get('/matches', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const matches = await CoPresenceMatch.find({
      $or: [{ userA: userId }, { userB: userId }],
    })
      .populate('userA', USER_PREVIEW_FIELDS)
      .populate('userB', USER_PREVIEW_FIELDS)
      .populate('memoryA', MEMORY_PREVIEW_FIELDS)
      .populate('memoryB', MEMORY_PREVIEW_FIELDS)
      .sort({ matchedAt: -1 });

    const shaped = matches.map((m) => {
      const userId_ = userId;
      return {
        _id: m._id,
        otherUser: otherSide(m, userId_),
        myMemory: mySide(m, userId_, 'memoryA', 'memoryB'),
        otherMemory: mySide(m, userId_, 'memoryB', 'memoryA'),
        matchedAt: m.matchedAt,
      };
    });

    res.json(shaped);
  } catch (err) {
    req.log.error({ err }, '[co-presence] error fetching matches');
    res.status(500).json({ message: 'Server error' });
  }
});

/*
Confirm the caller's own side of a candidate. Idempotent: confirming twice from the
same side is a no-op, not an error — a retried request (network hiccup, double-tap)
shouldn't fail just because it already succeeded once.

Authorization: 403, not a 404 or a silently-empty success, when the caller is neither
userA nor userB — a real user shouldn't get a response indistinguishable from "this
candidate doesn't exist" when the actual answer is "this isn't yours."
*/
router.post('/:id/confirm', coPresenceActionLimiter, verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const candidateId = req.params.id;

    // Read-only, for authorization and existence — safe to do outside the atomic
    // section below, because userA/userB never change after a candidate is created;
    // only `status` does, and that's the field the race actually lived in (see below).
    const existing = await CoPresenceCandidate.findById(candidateId).select('userA userB status');
    if (!existing) {
      return res.status(404).json({ message: 'Not found' });
    }

    const isA = existing.userA.toString() === userId;
    const isB = existing.userB.toString() === userId;
    if (!isA && !isB) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (existing.status === 'matched') {
      return res.json({ status: 'matched' });
    }

    /*
    Concurrency fix (audit finding BE-005). The old version read `candidate.status`
    into a JS variable, branched on it, then called `.save()` — a classic read-modify-
    write with a window in between where a concurrent request's write could be lost.
    If both participants confirmed within that window, both requests could read
    'pending', both compute their own next status independently, and neither would
    ever observe the other's write — so the pair could get stuck never reaching
    'matched' even though both people genuinely confirmed.

    Each write below is a findOneAndUpdate whose FILTER includes the exact prior
    status required for that transition — MongoDB executes it atomically against the
    one document it targets, so of two concurrent requests only one can ever have its
    filter match at a given instant. That alone isn't sufficient, though: a first,
    simpler version of this fix tried "other-side-confirmed → matched" then
    "pending → own-confirmed" as a fixed, one-shot pair of attempts, and a real
    concurrent test (tests/security-be005-confirm-race.test.js) caught it failing —
    when the OTHER side's write commits in the gap between this request's two
    attempts, both attempts see a status that no longer matches either filter, and a
    version that gives up there leaves BOTH requests reporting "awaiting" forever, the
    exact bug this was meant to fix, just relocated. The loop below instead always
    re-reads the actual current status after a failed attempt and retries against
    THAT — bounded at a handful of iterations, which is generous given only two
    participants can ever change this document's status at all.
    */
    const ownConfirmedStatus = isA ? 'confirmedByA' : 'confirmedByB';
    const otherConfirmedStatus = isA ? 'confirmedByB' : 'confirmedByA';

    let currentStatus = existing.status;
    let updated = null;
    let justMatched = false;

    for (let attempt = 0; attempt < 5 && !updated; attempt += 1) {
      if (currentStatus === 'matched') {
        updated = await CoPresenceCandidate.findById(candidateId);
        break;
      }

      if (currentStatus === otherConfirmedStatus) {
        updated = await CoPresenceCandidate.findOneAndUpdate(
          { _id: candidateId, status: otherConfirmedStatus },
          { $set: { status: 'matched' } },
          { new: true }
        );
        if (updated) {
          justMatched = true;
          break;
        }
      } else if (currentStatus === 'pending') {
        updated = await CoPresenceCandidate.findOneAndUpdate(
          { _id: candidateId, status: 'pending' },
          { $set: { status: ownConfirmedStatus } },
          { new: true }
        );
        if (updated) break;
      } else {
        // currentStatus === ownConfirmedStatus already — this side already confirmed;
        // idempotent no-op, nothing left to write.
        updated = await CoPresenceCandidate.findById(candidateId);
        break;
      }

      // The attempted write's filter didn't match — someone else changed the status
      // in the gap. Re-read the actual current value and retry against THAT on the
      // next loop iteration, rather than assuming either outcome.
      const fresh = await CoPresenceCandidate.findById(candidateId).select('status');
      currentStatus = fresh.status;
    }

    if (!updated) {
      return res.status(404).json({ message: 'Not found' });
    }

    if (justMatched) {
      try {
        await CoPresenceMatch.create({
          userA: updated.userA,
          userB: updated.userB,
          memoryA: updated.memoryA,
          memoryB: updated.memoryB,
        });
      } catch (err) {
        // Idempotency guard against a concurrent double-confirm race creating two
        // match rows for the same memory pair — the unique index is the real
        // guarantee, this just means "someone else already wrote it, fine."
        if (err.code !== 11000) throw err;
      }
    }

    // Audit trail only — who confirmed what, when, never exposed through any
    // user-facing response. `justMatched` is safe to log even though it's derived
    // from both sides' state, because this line never reaches a client.
    req.log.info({ candidateId, userId, justMatched }, '[co-presence] confirm');

    res.json({ status: updated.status === 'matched' ? 'matched' : 'awaiting_other_confirmation' });
  } catch (err) {
    req.log.error({ err }, '[co-presence] error confirming candidate');
    res.status(500).json({ message: 'Server error' });
  }
});

/*
Reject deletes the candidate outright — no soft "rejected" status kept around. A
rejected suggestion shouldn't linger as a row some future query has to remember to
filter out; the safest state for something no one wants surfaced is to not exist.

Once a pair has already reached 'matched', this route intentionally refuses — deciding
whether a completed, mutually-confirmed match can later be undone is a real product
decision (would need to remove the CoPresenceMatch row too, and that's a different,
more consequential action than declining a suggestion) and is deliberately left for a
later phase rather than folded in here by default.
*/
router.post('/:id/reject', coPresenceActionLimiter, verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const candidate = await CoPresenceCandidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ message: 'Not found' });
    }

    const isA = candidate.userA.toString() === userId;
    const isB = candidate.userB.toString() === userId;
    if (!isA && !isB) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (candidate.status === 'matched') {
      return res.status(400).json({ message: 'This has already been matched and cannot be rejected here' });
    }

    await CoPresenceCandidate.deleteOne({ _id: candidate._id });

    req.log.info({ candidateId: candidate._id, userId }, '[co-presence] reject');

    res.json({ status: 'rejected' });
  } catch (err) {
    req.log.error({ err }, '[co-presence] error rejecting candidate');
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
