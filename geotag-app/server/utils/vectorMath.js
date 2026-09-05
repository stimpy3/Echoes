/*
Pure vector math, split out of utils/embeddingHelper.js during the co-presence rollout's
Phase 3. Reason: embeddingHelper.js eagerly preloads the MiniLM text-embedding model as
a side effect of being require()'d at all (the `getExtractor().then(...)` call at its
bottom, deliberately kept there so the real app's first request doesn't pay model-load
time — see that file). Phase 3's candidate job only ever needed the generic
cosineSimilarity function, which has nothing to do with MiniLM specifically — but
importing it FROM embeddingHelper.js meant every process that requires the candidate
job (including the Jest test process, which never runs the real app) was also silently
loading a second, separate ONNX runtime session. That's what caused the test suite to
exit with a native `mutex lock failed` abort under --forceExit: two independent
onnxruntime sessions (one in the forked app process, one accidentally in the Jest
process) with one of them killed mid-operation.

embeddingHelper.js still re-exports these two functions unchanged, so nothing that
already imports them from there needs to change — this file exists so code that only
needs the MATH (like the candidate job) can depend on that alone, with zero model
loading as a side effect of require().
*/

/**
 * Mathematically computes the mean of an array of equal-length vectors, then
 * L2-normalizes the result.
 * @param {number[][]} embeddings
 * @returns {number[] | null}
 */
function averageEmbeddings(embeddings) {
    if (!embeddings || embeddings.length === 0) return null;

    const length = embeddings[0].length;
    const sumEmbedding = new Array(length).fill(0);

    for (const embedding of embeddings) {
        for (let i = 0; i < length; i++) {
            sumEmbedding[i] += embedding[i];
        }
    }

    const average = sumEmbedding.map(val => val / embeddings.length);

    const magnitude = Math.sqrt(average.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return average;

    return average.map(val => val / magnitude);
}

/**
 * Cosine similarity between two equal-length vectors. Generic over what the vectors
 * represent — text embeddings (utils/embeddingHelper.js's own use, e.g. Explore's
 * k-means step) and image embeddings (jobs/coPresenceCandidateJob.js's Phase 3 use)
 * are both just vectors as far as this function is concerned.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = { averageEmbeddings, cosineSimilarity };
