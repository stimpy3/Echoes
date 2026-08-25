/*
Co-presence rollout, Phase 3. Generates a CLIP embedding for a memory's photo — the
signal that separates "two people near the same place at the same time" (Phase 2) from
"two people who were actually together" (this phase), by letting the candidate job
compare what's actually IN the two photos, not just where and when they were taken.

Xenova/clip-vit-base-patch32 via @huggingface/transformers, same in-process, zero-cost
pattern already used for text embeddings (utils/embeddingHelper.js) — no separate model
server, no paid API.

Deliberately NOT preloaded at module load, unlike embeddingHelper.js's MiniLM (which
calls getExtractor() immediately so the first real request doesn't pay model-load time).
CLIP-ViT-B/32 is a meaningfully bigger download, and this repository's own rollout plan
flags Render's free-tier instance as genuinely resource-constrained for a second
in-process model — confirmed directly: a cold load attempt in one environment took over
90 seconds without finishing. Now wired into creatememory/editmemory (routes/
memoryRoutes.js) and started in server/index.js, so it loads lazily on whichever
request happens to enqueue the FIRST real image-embedding job after a boot — that one
request pays real model-download time; every one after it on the same running process
does not.
*/
const { pipeline } = require('@huggingface/transformers');
const logger = require('./logger');

let extractor = null;

async function getImageExtractor() {
  if (!extractor) {
    extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
  }
  return extractor;
}

/**
 * Generates a CLIP image embedding for a photo URL (a memory's Cloudinary `photoUrl` —
 * transformers.js's image pipelines accept a URL directly, no separate download step).
 * @param {string} imageUrl
 * @returns {Promise<number[] | null>}
 */
async function generateImageEmbedding(imageUrl) {
  try {
    const pipe = await getImageExtractor();
    const output = await pipe(imageUrl, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (error) {
    logger.error({ err: error, imageUrl }, 'Error generating image embedding');
    return null;
  }
}

module.exports = { generateImageEmbedding, getImageExtractor };
