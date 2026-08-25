const mongoose = require('mongoose');

/*
Co-presence rollout, Phase 1: schema only. Nothing in the running app reads, writes, or
even require()s this model yet — Phase 2 introduces the batch job that populates it, and
Phase 4 introduces the routes that read it. Declared now so later phases only add
behavior, never a schema migration.

Deliberately NOT embedded on User or Memory — this is derived, disposable data (a fresh
run of Phase 2's job can regenerate it), not a source of truth, so it gets its own
collection the same way Follower/FollowRequest do rather than growing an array on a
document that has to stay small.

status lifecycle (enforced by Phase 4's routes, not by anything today):
  pending            -> neither user has acted yet
  confirmedByA / B   -> one side confirmed, waiting on the other
  matched            -> both sides confirmed — the ONLY status any read-facing route
                        may ever surface to a user other than the two involved
  (rejecting deletes the document outright rather than flagging it — see the rollout
  plan's Phase 4 notes on why a match must never be inferable from a status value that
  used to exist)
*/
const coPresenceCandidateSchema = new mongoose.Schema({
  userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  memoryA: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory', required: true },
  memoryB: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory', required: true },

  distanceMeters: { type: Number, required: true },
  timeDeltaMinutes: { type: Number, required: true },
  // Populated by Phase 3 (image-embedding similarity). Null until then — a candidate
  // with no visual score yet is a Phase-2-only "coarse candidate," never shown to anyone.
  visualSimilarity: { type: Number, default: null },

  status: {
    type: String,
    enum: ['pending', 'confirmedByA', 'confirmedByB', 'matched'],
    default: 'pending'
  },

  createdAt: { type: Date, default: Date.now }
});

// Supports "does a candidate already exist for this pair of memories" (Phase 2's own
// idempotency check) and "give me this user's pending candidates" (Phase 4's read path)
// without a collection scan, without being queried by anything today.
coPresenceCandidateSchema.index({ memoryA: 1, memoryB: 1 }, { unique: true });
coPresenceCandidateSchema.index({ userA: 1, status: 1 });
coPresenceCandidateSchema.index({ userB: 1, status: 1 });

module.exports = mongoose.model('CoPresenceCandidate', coPresenceCandidateSchema);
