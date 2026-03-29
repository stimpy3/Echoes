const { pipeline } = require('@huggingface/transformers');

let extractor = null;

/**
 * Initializes the embedding pipeline if not already loaded.
 */
async function getExtractor() {
    if (!extractor) {
        // 'feature-extraction' is used for generating embeddings
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return extractor;
}

/**
 * Generates a text embedding for the given string.
 * @param {string} text - The input text (title + description).
 * @returns {Promise<number[]>} - The generated embedding vector.
 */
async function generateEmbedding(text) {
    try {
        const pipe = await getExtractor();
        // Generate features (embeddings)
        const output = await pipe(text, { pooling: 'mean', normalize: true });
        // Convert the tensor to a plain JavaScript array
        return Array.from(output.data);
    } catch (error) {
        console.error('Error generating embedding:', error);
        return null;
    }
}

async function generateEmbeddingWithRetry(text, options = {}) {
    const {
        maxRetries = 2,
        initialDelayMs = 250,
        backoffMultiplier = 2
    } = options;

    let attempt = 0;
    let delayMs = initialDelayMs;

    while (attempt <= maxRetries) {
        const embedding = await generateEmbedding(text);
        if (embedding && embedding.length > 0) {
            return embedding;
        }

        if (attempt === maxRetries) {
            break;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= backoffMultiplier;
        attempt += 1;
    }

    return null;
}

/**
 * Mathematically computes the mean of an array of 384-dimensional vectors.
 * @param {number[][]} embeddings - Array of embedding arrays.
 * @returns {number[]} - Averaged embedding vector.
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
    
    // Mean
    const average = sumEmbedding.map(val => val / embeddings.length);
    
    // Normalize logic
    const magnitude = Math.sqrt(average.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return average;
    
    return average.map(val => val / magnitude);
}

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

/**
 * Clusters embeddings into k distinct interest vectors using K-Means and Cosine Similarity.
 * @param {number[][]} embeddings - Array of embedding arrays.
 * @param {number} k - Number of clusters (default 3).
 * @param {number} maxIterations - Max iterations for convergence.
 * @returns {number[][]} - Array of centroid vectors.
 */
function kMeansCluster(embeddings, k = 3, maxIterations = 10) {
    if (!embeddings || embeddings.length === 0) return [];
    if (embeddings.length <= k) return embeddings; // Return all if fewer than k

    // 1. Initialize k random centroids
    let centroids = [];
    const usedIndices = new Set();
    while (centroids.length < k) {
        let randIdx = Math.floor(Math.random() * embeddings.length);
        if (!usedIndices.has(randIdx)) {
            centroids.push([...embeddings[randIdx]]);
            usedIndices.add(randIdx);
        }
    }

    let assignments = new Array(embeddings.length).fill(-1);

    for (let iter = 0; iter < maxIterations; iter++) {
        let changed = false;

        // 2. Assign each embedding to the closest centroid
        for (let i = 0; i < embeddings.length; i++) {
            let bestCluster = 0;
            let bestSim = -Infinity;

            for (let c = 0; c < k; c++) {
                let sim = cosineSimilarity(embeddings[i], centroids[c]);
                if (sim > bestSim) {
                    bestSim = sim;
                    bestCluster = c;
                }
            }

            if (assignments[i] !== bestCluster) {
                assignments[i] = bestCluster;
                changed = true;
            }
        }

        if (!changed) break; // Converged early

        // 3. Update centroids
        for (let c = 0; c < k; c++) {
            let clusterPoints = [];
            for (let i = 0; i < embeddings.length; i++) {
                if (assignments[i] === c) {
                    clusterPoints.push(embeddings[i]);
                }
            }

            if (clusterPoints.length > 0) {
                centroids[c] = averageEmbeddings(clusterPoints);
            } else {
                let randIdx = Math.floor(Math.random() * embeddings.length);
                centroids[c] = [...embeddings[randIdx]];
            }
        }
    }

    return centroids;
}

// Pre-load the model immediately on server start so it's ready for the first request
getExtractor().then(() => {
    console.log("✅ AI Embedding Model loaded and ready!");
}).catch(err => {
    console.error("❌ Failed to pre-load embedding model:", err);
});

module.exports = {
    generateEmbedding,
    generateEmbeddingWithRetry,
    averageEmbeddings,
    kMeansCluster,
    cosineSimilarity
};
