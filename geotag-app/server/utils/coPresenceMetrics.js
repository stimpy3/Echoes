/*
Co-presence rollout, Phase 6. This project logs no interaction data at all today — this
is the first real, queryable signal for whether the feature is doing anything, not just
whether the job runs without throwing. Deliberately kept to what's cheaply and honestly
available from current data:

  - candidatesByStatus: how many candidates currently sit at each stage of the
    pending -> confirmedByA/B -> matched lifecycle.
  - totalMatches: how many CoPresenceMatch rows exist.
  - matchRate: matches / (matches + still-pending-or-partially-confirmed). NOT a true
    accept/reject rate — reject deletes its row outright (see routes/coPresenceRoutes.js
    for why), so a rejected candidate leaves no trace to count against this ratio. This
    number can only ever be read as "of what's currently in flight or matched, how much
    reached matched" — an honest, present-tense snapshot, not a historical rate. A real
    accept/reject rate needs an actual event log, which is a bigger, separate piece of
    work (interaction logging is flagged as a prerequisite for several other roadmap
    items too, not just this one).
*/
const CoPresenceCandidate = require('../models/coPresenceCandidate');
const CoPresenceMatch = require('../models/coPresenceMatch');

async function getCoPresenceMetrics() {
  const statuses = ['pending', 'confirmedByA', 'confirmedByB', 'matched'];

  const counts = await Promise.all(
    statuses.map((status) => CoPresenceCandidate.countDocuments({ status }))
  );

  const candidatesByStatus = Object.fromEntries(statuses.map((status, i) => [status, counts[i]]));
  const totalMatches = await CoPresenceMatch.countDocuments();

  const inFlightOrMatched = candidatesByStatus.pending
    + candidatesByStatus.confirmedByA
    + candidatesByStatus.confirmedByB
    + candidatesByStatus.matched;

  const matchRate = inFlightOrMatched === 0 ? null : candidatesByStatus.matched / inFlightOrMatched;

  return { candidatesByStatus, totalMatches, matchRate };
}

module.exports = { getCoPresenceMetrics };
