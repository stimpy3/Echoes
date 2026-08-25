const { Worker } = require('bullmq');
const { createClient } = require('../utils/redisClient');
const { runCoPresenceCandidateJob } = require('../jobs/coPresenceCandidateJob');
const logger = require('../utils/logger');

const workerLogger = logger.child({ component: 'copresence-candidate-worker' });

/*
Consumer side of queues/coPresenceCandidateQueue.js's repeatable schedule. Deliberately
thin — all the actual eligibility/candidate-generation logic already lives in, and is
already tested via, jobs/coPresenceCandidateJob.js; this file's only job is to be the
thing that actually calls it on a schedule; runCoPresenceCandidateJob() itself already
logs its own summary (skipped/pairsConsidered/candidatesWritten/etc.), so there's
nothing worth duplicating here beyond letting a genuine failure surface.

Started in-process from index.js, same single-Render-instance trade-off as the embedding
workers — see their own comments there for the fuller reasoning.
*/
const connection = createClient();

const coPresenceCandidateWorker = new Worker(
  'copresence-candidate-schedule',
  async () => {
    await runCoPresenceCandidateJob();
  },
  { connection }
);

coPresenceCandidateWorker.on('failed', (job, err) => {
  workerLogger.error({ err }, 'co-presence candidate job run failed');
});

module.exports = { coPresenceCandidateWorker };
