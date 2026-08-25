// Phase 4 of the co-presence rollout plan: the confirmation flow.
//
// This is the highest-scrutiny phase — the first one with a real, reachable API
// surface for co-presence at all. Every test below exists to defend one property with
// zero exceptions: a match is only ever visible to either party after BOTH confirm,
// and confirming alone must never leak to the other party — not that a candidate
// exists, not that the other side has already acted.
//
// Runs against the real forked app (HTTP, via supertest, real cookies) for the routes
// themselves, and a direct DB connection (same pattern as earlier phase test files) to
// seed CoPresenceCandidate fixtures directly — this file isn't re-testing candidate
// GENERATION (that's Phase 2/3's job), only the confirm/reject/pending/matches routes.

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const mongoose = require('mongoose');
const { flushRateLimits } = require('./helpers/flushRateLimits');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { baseURL, mongoUri } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

let Memory, CoPresenceCandidate, CoPresenceMatch;

beforeAll(async () => {
  await mongoose.connect(mongoUri);
  Memory = require('../models/memories');
  CoPresenceCandidate = require('../models/coPresenceCandidate');
  CoPresenceMatch = require('../models/coPresenceMatch');
});

afterAll(async () => {
  await mongoose.disconnect();
});

// This file creates several real user accounts PER TEST (2-3 signups each, across 9
// tests) — comfortably more than the real 5/hour signup limiter allows in one run. A
// single flush at file-start (enough for earlier, lighter phase files) isn't enough
// here; each test needs its own fresh budget, or later tests fail on a real, correctly-
// working rate limit that has nothing to do with the behavior under test.
beforeEach(flushRateLimits);

function extractTokenCookie(res) {
  const setCookie = res.headers['set-cookie'];
  const tokenLine = setCookie.find((c) => c.startsWith('token='));
  return tokenLine.split(';')[0];
}

let seq = 0;
function uniqueEmail(tag) {
  seq += 1;
  return `phase4-${tag}-${Date.now()}-${seq}@example.test`;
}

async function createUser(name) {
  const email = uniqueEmail(name.replace(/\s+/g, ''));
  const signupRes = await request(baseURL)
    .post('/api/auth/signup')
    .send({ name, email, password: 'correct-horse-battery' });
  const cookie = extractTokenCookie(signupRes);
  const navbarRes = await request(baseURL).get('/api/user/navbar').set('Cookie', cookie);
  return { id: navbarRes.body._id, cookie };
}

async function makeMemory(userId, lng) {
  return Memory.create({
    userId,
    title: 'Fixture memory',
    description: 'Phase 4 confirmation-flow fixture',
    location: { type: 'Point', coordinates: [lng, 19.076], address: 'Fixture address' },
    photoUrl: 'https://example.test/fixture.jpg',
  });
}

async function seedCandidate(userAId, userBId) {
  const memA = await makeMemory(userAId, 72.8777);
  const memB = await makeMemory(userBId, 72.8778);
  const candidate = await CoPresenceCandidate.create({
    userA: userAId,
    userB: userBId,
    memoryA: memA._id,
    memoryB: memB._id,
    distanceMeters: 15,
    timeDeltaMinutes: 3,
    visualSimilarity: 0.9,
  });
  return candidate;
}

describe('Phase 4 — co-presence confirmation flow', () => {
  test('an uninvolved third user gets 403 trying to confirm or reject someone else\'s candidate', async () => {
    const userA = await createUser('P4 AuthA');
    const userB = await createUser('P4 AuthB');
    const stranger = await createUser('P4 AuthStranger');
    const candidate = await seedCandidate(userA.id, userB.id);

    const confirmRes = await request(baseURL)
      .post(`/api/copresence/${candidate._id}/confirm`)
      .set('Cookie', stranger.cookie);
    expect(confirmRes.status).toBe(403);

    const rejectRes = await request(baseURL)
      .post(`/api/copresence/${candidate._id}/reject`)
      .set('Cookie', stranger.cookie);
    expect(rejectRes.status).toBe(403);
  });

  test('an uninvolved third user never sees the candidate at all in their own /pending', async () => {
    const userA = await createUser('P4 OmitA');
    const userB = await createUser('P4 OmitB');
    const stranger = await createUser('P4 OmitStranger');
    const candidate = await seedCandidate(userA.id, userB.id);

    const strangerPending = await request(baseURL).get('/api/copresence/pending').set('Cookie', stranger.cookie);
    const ids = strangerPending.body.map((c) => c._id);
    expect(ids).not.toContain(String(candidate._id));
  });

  test('both sides see the candidate in /pending before anyone confirms, each with myConfirmed: false', async () => {
    const userA = await createUser('P4 PendA');
    const userB = await createUser('P4 PendB');
    const candidate = await seedCandidate(userA.id, userB.id);

    const aPending = await request(baseURL).get('/api/copresence/pending').set('Cookie', userA.cookie);
    const bPending = await request(baseURL).get('/api/copresence/pending').set('Cookie', userB.cookie);

    const aEntry = aPending.body.find((c) => c._id === String(candidate._id));
    const bEntry = bPending.body.find((c) => c._id === String(candidate._id));

    expect(aEntry).toBeTruthy();
    expect(bEntry).toBeTruthy();
    expect(aEntry.myConfirmed).toBe(false);
    expect(bEntry.myConfirmed).toBe(false);
    // Each side sees the OTHER user as `otherUser` — never themselves.
    expect(aEntry.otherUser._id).toBe(userB.id);
    expect(bEntry.otherUser._id).toBe(userA.id);
  });

  test('A confirming does not reveal anything to B, and does not create a match yet', async () => {
    const userA = await createUser('P4 LeakA');
    const userB = await createUser('P4 LeakB');
    const candidate = await seedCandidate(userA.id, userB.id);

    const confirmRes = await request(baseURL)
      .post(`/api/copresence/${candidate._id}/confirm`)
      .set('Cookie', userA.cookie);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.status).toBe('awaiting_other_confirmation');

    // The actual leak test: B's own view of this exact candidate must be
    // indistinguishable from before A acted at all.
    const bPending = await request(baseURL).get('/api/copresence/pending').set('Cookie', userB.cookie);
    const bEntry = bPending.body.find((c) => c._id === String(candidate._id));
    expect(bEntry).toBeTruthy();
    expect(bEntry.myConfirmed).toBe(false);
    expect(Object.keys(bEntry)).not.toContain('otherConfirmed');
    expect(JSON.stringify(bEntry)).not.toMatch(/confirmedByA/i);

    // No match exists yet — only one side has confirmed.
    const matchCount = await CoPresenceMatch.countDocuments({
      memoryA: candidate.memoryA,
      memoryB: candidate.memoryB,
    });
    expect(matchCount).toBe(0);

    // A's own view now correctly shows their own confirmation.
    const aPending = await request(baseURL).get('/api/copresence/pending').set('Cookie', userA.cookie);
    const aEntry = aPending.body.find((c) => c._id === String(candidate._id));
    expect(aEntry.myConfirmed).toBe(true);
  });

  test('once BOTH sides confirm, it becomes a match visible to both, and disappears from /pending for both', async () => {
    const userA = await createUser('P4 MatchA');
    const userB = await createUser('P4 MatchB');
    const candidate = await seedCandidate(userA.id, userB.id);

    await request(baseURL).post(`/api/copresence/${candidate._id}/confirm`).set('Cookie', userA.cookie);
    const secondConfirm = await request(baseURL)
      .post(`/api/copresence/${candidate._id}/confirm`)
      .set('Cookie', userB.cookie);

    expect(secondConfirm.status).toBe(200);
    expect(secondConfirm.body.status).toBe('matched');

    const aMatches = await request(baseURL).get('/api/copresence/matches').set('Cookie', userA.cookie);
    const bMatches = await request(baseURL).get('/api/copresence/matches').set('Cookie', userB.cookie);
    expect(aMatches.body.some((m) => m.otherUser._id === userB.id)).toBe(true);
    expect(bMatches.body.some((m) => m.otherUser._id === userA.id)).toBe(true);

    const aPending = await request(baseURL).get('/api/copresence/pending').set('Cookie', userA.cookie);
    const bPending = await request(baseURL).get('/api/copresence/pending').set('Cookie', userB.cookie);
    expect(aPending.body.find((c) => c._id === String(candidate._id))).toBeUndefined();
    expect(bPending.body.find((c) => c._id === String(candidate._id))).toBeUndefined();

    const matchCount = await CoPresenceMatch.countDocuments({
      memoryA: candidate.memoryA,
      memoryB: candidate.memoryB,
    });
    expect(matchCount).toBe(1);
  });

  test('confirming again after already matched is idempotent — no duplicate match row, no error', async () => {
    const userA = await createUser('P4 IdemA');
    const userB = await createUser('P4 IdemB');
    const candidate = await seedCandidate(userA.id, userB.id);

    await request(baseURL).post(`/api/copresence/${candidate._id}/confirm`).set('Cookie', userA.cookie);
    await request(baseURL).post(`/api/copresence/${candidate._id}/confirm`).set('Cookie', userB.cookie);

    // Re-confirm from both sides again.
    const reconfirmA = await request(baseURL).post(`/api/copresence/${candidate._id}/confirm`).set('Cookie', userA.cookie);
    const reconfirmB = await request(baseURL).post(`/api/copresence/${candidate._id}/confirm`).set('Cookie', userB.cookie);

    expect(reconfirmA.status).toBe(200);
    expect(reconfirmA.body.status).toBe('matched');
    expect(reconfirmB.status).toBe(200);
    expect(reconfirmB.body.status).toBe('matched');

    const matchCount = await CoPresenceMatch.countDocuments({
      memoryA: candidate.memoryA,
      memoryB: candidate.memoryB,
    });
    expect(matchCount).toBe(1);
  });

  test('rejecting deletes the candidate outright — it disappears from /pending and confirming it afterward 404s', async () => {
    const userA = await createUser('P4 RejA');
    const userB = await createUser('P4 RejB');
    const candidate = await seedCandidate(userA.id, userB.id);

    const rejectRes = await request(baseURL)
      .post(`/api/copresence/${candidate._id}/reject`)
      .set('Cookie', userB.cookie);
    expect(rejectRes.status).toBe(200);

    const stillThere = await CoPresenceCandidate.findById(candidate._id);
    expect(stillThere).toBeNull();

    const aPending = await request(baseURL).get('/api/copresence/pending').set('Cookie', userA.cookie);
    expect(aPending.body.find((c) => c._id === String(candidate._id))).toBeUndefined();

    const confirmAfterReject = await request(baseURL)
      .post(`/api/copresence/${candidate._id}/confirm`)
      .set('Cookie', userA.cookie);
    expect(confirmAfterReject.status).toBe(404);
  });

  test('rejecting an already-matched candidate is refused (400) and the match is untouched', async () => {
    const userA = await createUser('P4 NoUnmatchA');
    const userB = await createUser('P4 NoUnmatchB');
    const candidate = await seedCandidate(userA.id, userB.id);

    await request(baseURL).post(`/api/copresence/${candidate._id}/confirm`).set('Cookie', userA.cookie);
    await request(baseURL).post(`/api/copresence/${candidate._id}/confirm`).set('Cookie', userB.cookie);

    const rejectAfterMatch = await request(baseURL)
      .post(`/api/copresence/${candidate._id}/reject`)
      .set('Cookie', userA.cookie);
    expect(rejectAfterMatch.status).toBe(400);

    const matchCount = await CoPresenceMatch.countDocuments({
      memoryA: candidate.memoryA,
      memoryB: candidate.memoryB,
    });
    expect(matchCount).toBe(1);
  });

  test('confirm/reject are rate-limited independently of every other route\'s limiter', async () => {
    // Isolate this check from every confirm/reject call the tests above already made
    // in this same run — otherwise this test would trip on THEIR budget, not its own.
    await flushRateLimits();

    const userA = await createUser('P4 RateA');
    const userB = await createUser('P4 RateB');

    let lastStatus = 200;
    for (let i = 0; i < 35; i += 1) {
      // A nonexistent id is fine — the rate limiter runs before the route handler
      // even looks the id up, so every one of these 35 requests counts against it
      // regardless of the 404 each would otherwise get.
      const res = await request(baseURL)
        .post('/api/copresence/000000000000000000000000/confirm')
        .set('Cookie', userA.cookie);
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }

    expect(lastStatus).toBe(429);

    // And confirm this limiter is genuinely independent — B, a different user (so a
    // different rate-limit key, since express-rate-limit's default keyGenerator is
    // per-IP, not per-user, but this at least proves the earlier loop didn't exhaust
    // some OTHER route's budget), can still reach the login endpoint normally.
    const loginStillWorks = await request(baseURL)
      .post('/api/auth/login')
      .send({ email: 'nonexistent-unrelated@example.test', password: 'whatever' });
    expect(loginStillWorks.status).toBe(401); // not 429 — a different limiter, a different key.
  });
});
