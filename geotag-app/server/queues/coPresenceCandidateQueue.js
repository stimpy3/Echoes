const { Queue } = require('bullmq');
const { createClient } = require('../utils/redisClient');

/*
Loose end closed: jobs/coPresenceCandidateJob.js existed with real logic and real tests,
but nothing ever actually triggered it outside the test suite — no cron, no scheduled
task, nothing. In a real deployment it would simply never run, and co-presence
candidates would never be generated for real users. This queue is the scheduling half
that was missing.

Same dedicated-connection reasoning as queues/embeddingQueue.js — BullMQ needs its own
Redis connection, separate from the shared get/set client used for cache/rate limiting.
*/
const connection = createClient();

const coPresenceCandidateQueue = new Queue('copresence-candidate-schedule', { connection });

// Overridable for tests/local tuning; defaults to hourly — this is a background
// enrichment job, not something latency-sensitive enough to justify running more often.
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

/*
Registers the repeatable job via BullMQ's Job Scheduler API (the 6.x replacement for the
older `queue.add(..., { repeat })` shape — that older form was tried first here and
silently did NOT register a recurring schedule under this BullMQ version, confirmed by
checking queue.getJobSchedulers() after calling it: empty. upsertJobScheduler is
explicitly idempotent by name (an "upsert," not an "add") — safe to call on every server
boot; a restart updates the existing scheduler in place rather than creating a second,
competing one.

The job itself carries no meaningful data — runCoPresenceCandidateJob() (see
jobs/coPresenceCandidateJob.js) already checks the COPRESENCE_ENABLED kill switch as its
own first step and returns a no-op summary without touching the database when disabled,
so this scheduler doesn't need to duplicate that check; it can always be registered.
*/
const SCHEDULER_ID = 'copresence-candidate-schedule';

async function scheduleCoPresenceCandidateJob(intervalMs = DEFAULT_INTERVAL_MS) {
  await coPresenceCandidateQueue.upsertJobScheduler(
    SCHEDULER_ID,
    { every: intervalMs },
    {
      name: 'run',
      opts: {
        removeOnComplete: 10,
        removeOnFail: 50,
      },
    }
  );
}

module.exports = { coPresenceCandidateQueue, scheduleCoPresenceCandidateJob, DEFAULT_INTERVAL_MS };
