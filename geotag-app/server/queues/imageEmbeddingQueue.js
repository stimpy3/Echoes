const { Queue } = require('bullmq');
const { createClient } = require('../utils/redisClient');

/*
Co-presence rollout, Phase 3. A SEPARATE queue name ('image-embedding-generation') from
the existing text-embedding queue ('embedding-generation' in embeddingQueue.js) — on
purpose. CLIP inference is a meaningfully heavier job than the MiniLM text embedding
(see utils/imageEmbeddingHelper.js for why), and a backlog in one must never delay the
other. Same connection-per-queue reasoning as embeddingQueue.js: BullMQ needs its own
dedicated Redis connection per Queue/Worker, not the shared plain-command client.

NOT required by anything today (see workers/imageEmbeddingWorker.js and
routes/memoryRoutes.js) — constructing a Queue instance itself is cheap and doesn't
touch the CLIP model at all; it's the worker actually pulling and processing a job that
would.
*/
const connection = createClient();

const imageEmbeddingQueue = new Queue('image-embedding-generation', { connection });

async function enqueueImageEmbeddingJob(memoryId, photoUrl) {
  await imageEmbeddingQueue.add(
    'generate',
    { memoryId: memoryId.toString(), photoUrl },
    {
      attempts: 4,
      backoff: { type: 'exponential', delay: 300 },
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}

module.exports = { imageEmbeddingQueue, enqueueImageEmbeddingJob };
