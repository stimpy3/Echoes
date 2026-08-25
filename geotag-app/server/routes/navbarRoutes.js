const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { socialActionLimiter } = require('../middleware/rateLimiter');
const User = require('../models/users');
const CoPresenceCandidate = require('../models/coPresenceCandidate');
const { invalidateCache } = require('../utils/cache');


router.get('/navbar', verifyToken, async (req, res) => {
 try {
  // coPresenceOptIn added here (Phase 1 of the co-presence rollout) so the Settings
  // toggle has a current value to render — not read or cached by anything else yet.
  const user = await User.findById(req.userId).select('_id name email profilePic isPrivate coPresenceOptIn');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
 } catch (err) {
  res.status(500).json({ message: 'Server error' });
 }
});

// Update privacy status
router.patch('/privacy', socialActionLimiter, verifyToken, async (req, res) => {
  try {
    const { isPrivate } = req.body;
    const user = await User.findByIdAndUpdate(req.userId, { isPrivate }, { new: true }).select('isPrivate');
    //Key must match userRoutes.js's GET /:id cache key exactly, or the stale value keeps
    //serving until its TTL expires — this route is the only writer of that payload's fields.
    await invalidateCache(`user:${req.userId}`, req.log);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error updating privacy' });
  }
});

/*
Co-presence rollout, Phase 1 (flag), extended in Phase 5 (purge on opt-out). Toggles the
caller's OWN opt-in flag only — req.userId comes from the verified JWT (verifyToken),
never from the request body, so there is no way for this route to set anyone else's
flag. This flag isn't part of the cached GET /api/users/:id payload (that route selects
a different, smaller field set — see userRoutes.js), so there is nothing to invalidate
here unlike the /privacy route above.

Opting OUT immediately deletes every NOT-YET-matched CoPresenceCandidate this user is
part of — a suggestion nobody has both agreed to shouldn't keep existing in the
database once one side has withdrawn consent to the feature at all. Already-confirmed
CoPresenceMatch rows are deliberately left untouched: both people already explicitly
agreed to that specific one, and un-consenting from FUTURE suggestions is a different,
smaller decision than retroactively undoing a past mutual confirmation — the rollout
plan leaves that second, bigger decision for a later phase to define on purpose, not as
an oversight here.
*/
router.patch('/co-presence-opt-in', socialActionLimiter, verifyToken, async (req, res) => {
  try {
    const { optIn } = req.body;
    if (typeof optIn !== 'boolean') {
      return res.status(400).json({ message: 'optIn must be a boolean' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { coPresenceOptIn: optIn },
      { new: true }
    ).select('coPresenceOptIn');

    if (optIn === false) {
      try {
        await CoPresenceCandidate.deleteMany({
          $or: [{ userA: req.userId }, { userB: req.userId }],
          status: { $ne: 'matched' },
        });
      } catch (err) {
        req.log?.error({ err }, '[co-presence] failed to purge pending candidates on opt-out');
      }
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error updating co-presence opt-in' });
  }
});

module.exports = router;