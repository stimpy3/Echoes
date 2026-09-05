const { Worker } = require('bullmq');
const { createClient } = require('../utils/redisClient');
const { generateImageEmbedding } = require('../utils/imageEmbeddingHelper');
const Memory = require('../models/memories');
const logger = require('../utils/logger');

const workerLogger = logger.child({ component: 'image-embedding-worker' });

/*
Co-presence rollout, Phase 3. Mirrors workers/embeddingWorker.js's structure exactly —
same non-nested-retry reasoning (BullMQ owns retries here, not generateImageEmbedding
itself), same single-attempts-then-throw pattern.

Started from server/index.js (`require("./workers/imageEmbeddingWorker")`), and
routes/memoryRoutes.js now enqueues real jobs for it on creatememory/editmemory. Given
CLIP's real load cost on a resource-constrained instance (see
utils/imageEmbeddingHelper.js), this was deliberately held back until confirmed — see
that file's header for the current state of that confirmation.
*/
const connection = createClient();

const imageEmbeddingWorker = new Worker(
  'image-embedding-generation',
  async (job) => {
    const { memoryId, photoUrl } = job.data;

    const imageEmbedding = await generateImageEmbedding(photoUrl);

    if (!imageEmbedding || imageEmbedding.length === 0) {
      throw new Error(`generateImageEmbedding returned empty result for memory ${memoryId}`);
    }

    await Memory.findByIdAndUpdate(memoryId, { imageEmbedding });
    workerLogger.info({ memoryId }, 'image embedding completed');
  },
  { connection }
);

imageEmbeddingWorker.on('failed', (job, err) => {
  workerLogger.error(
    { memoryId: job?.data?.memoryId, err },
    'image embedding job failed after all attempts'
  );
});

module.exports = { imageEmbeddingWorker };
