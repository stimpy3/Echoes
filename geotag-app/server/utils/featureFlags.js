/*
Co-presence rollout, Phase 6. A single, env-driven kill switch independent of any
individual user's opt-in — the point of this phase per the rollout plan: an emergency
rollback path that doesn't require a deploy. Flipping COPRESENCE_ENABLED=false in the
hosting platform's env vars and restarting the process is enough; no code change, no
redeploy of a fix.

Defaults to enabled (unset or anything other than the literal string 'false') — the
per-user opt-in and mutual-follow requirements are already the real gates on this
feature; this flag exists purely as a global emergency stop, not as a second everyday
on/off switch, so its default should be "on" rather than "opt into existence."

Deliberately does NOT touch any existing data when flipped off — see
jobs/coPresenceCandidateJob.js and routes/coPresenceRoutes.js for what checking this
actually does at each call site. Existing opt-in flags, pending candidates, and
confirmed matches are all left exactly as they are; this only stops NEW activity.
*/
function isCoPresenceEnabled() {
  return process.env.COPRESENCE_ENABLED !== 'false';
}

module.exports = { isCoPresenceEnabled };
