const mongoose = require('mongoose');

/*
Co-presence rollout, Phase 4. The ONLY collection any read-facing route may query to
answer "who was I with" — never CoPresenceCandidate directly, even though a matched
candidate also carries status: 'matched'. This is deliberate redundancy: a bug in some
future route that forgets to filter candidates by status would still be structurally
incapable of leaking a non-matched (or one-sided) candidate, because it would have to
query a collection that only ever contains rows created after BOTH sides already
confirmed (see routes/coPresenceRoutes.js's confirm handler — this is only ever
inserted there, and only in the branch where the second confirmation just landed).
*/
const coPresenceMatchSchema = new mongoose.Schema({
  userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  memoryA: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory', required: true },
  memoryB: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory', required: true },
  matchedAt: { type: Date, default: Date.now }
});

coPresenceMatchSchema.index({ memoryA: 1, memoryB: 1 }, { unique: true });
coPresenceMatchSchema.index({ userA: 1 });
coPresenceMatchSchema.index({ userB: 1 });

module.exports = mongoose.model('CoPresenceMatch', coPresenceMatchSchema);
