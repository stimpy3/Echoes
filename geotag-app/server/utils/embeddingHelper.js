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

// Pre-load the model immediately on server start so it's ready for the first request
getExtractor().then(() => {
    console.log("✅ AI Embedding Model loaded and ready!");
}).catch(err => {
    console.error("❌ Failed to pre-load embedding model:", err);
});

module.exports = { generateEmbedding, averageEmbeddings };
