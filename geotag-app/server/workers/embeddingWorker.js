const { Worker } = require('bullmq');
const { createClient } = require('../utils/redisClient');
const { generateEmbedding } = require('../utils/embeddingHelper');
const Memory = require('../models/memories');
const logger = require('../utils/logger');

//Jobs have no HTTP request to inherit an id from — this tags every line from this file
//with { component: 'embedding-worker' } instead, the same idea as a request id: a way to
//filter "everything from one source" out of the combined log stream.
const workerLogger = logger.child({ component: 'embedding-worker' });

/*
Consumer side. Deliberately uses generateEmbedding (single attempt), NOT
generateEmbeddingWithRetry — retries are now BullMQ's job (attempts + backoff, set where
the job is enqueued in queues/embeddingQueue.js), not this function's. Nesting the old
manual retry loop inside a job BullMQ ALSO retries would mean up to 4 job attempts each
privately retrying 3 more times internally — the same failure retried up to 12 times
without either layer knowing about the other. One system should own retry semantics.

Started in-process from index.js (not a separate deployed worker) because this app runs
as one Render instance today — see the README's §3 Redis section for the same reasoning
applied to the Socket.IO adapter. If Explore or upload volume ever justifies a dedicated
worker dyno, this file's job logic doesn't change, only where it's require()'d from.
*/
const connection = createClient();

const embeddingWorker = new Worker(
  'embedding-generation',
  async (job) => {
    const { memoryId, text } = job.data;

    const embedding = await generateEmbedding(text);

    //Throwing (rather than returning/logging) is what tells BullMQ this attempt failed
    //and it should retry per the job's backoff config — swallowing this here would look
    //identical to success from the queue's point of view.
    if (!embedding || embedding.length === 0) {
      throw new Error(`generateEmbedding returned empty result for memory ${memoryId}`);
    }

    await Memory.findByIdAndUpdate(memoryId, { embedding });
    workerLogger.info({ memoryId }, 'embedding completed');
  },
  { connection }
);

embeddingWorker.on('failed', (job, err) => {
  //Reached only after all of the job's configured attempts are exhausted.
  workerLogger.error(
    { memoryId: job?.data?.memoryId, err },
    'embedding job failed after all attempts'
  );
});

module.exports = { embeddingWorker };
