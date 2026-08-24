const { Queue } = require('bullmq');
const { createClient } = require('../utils/redisClient');

/*
Producer side of the embedding job queue. BullMQ requires each Queue/Worker to own a
DEDICATED Redis connection — not the shared utils/redisClient.js singleton, which is used
for plain get/set commands elsewhere (cache, rate limiting) and would conflict with BullMQ's
own blocking commands on the same connection. Same reasoning as the Socket.IO adapter's
pub/sub duplicate() split in index.js: different consumers, different connections.
*/
const connection = createClient();

const embeddingQueue = new Queue('embedding-generation', { connection });

/*
Replaces the old fire-and-forget `(async () => { ... })()` IIFE in memoryRoutes.js. That
pattern had two real failures: a job in flight when the process restarts (deploy, crash,
Render's free-tier idle/wake cycle) is just gone — nothing wrote it down anywhere — and a
failure after the internal retries were exhausted was a console.warn with no way to retry
it later short of re-editing the memory by hand. A queued job survives a restart (it's
sitting in Redis, not process memory) and BullMQ's own attempts/backoff replaces the
hand-rolled retry loop that used to live in generateEmbeddingWithRetry.

removeOnComplete: true — a completed embedding job carries no information worth keeping;
the outcome (the embedding) is already written to the Memory document itself.
removeOnFail: keep the last 100 — enough to see what's actually breaking without letting
a bad patch of failures grow the job list without bound.
*/
async function enqueueEmbeddingJob(memoryId, text) {
  await embeddingQueue.add(
    'generate',
    { memoryId: memoryId.toString(), text },
    {
      attempts: 4,
      backoff: { type: 'exponential', delay: 300 },
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}

module.exports = { embeddingQueue, enqueueEmbeddingJob };
