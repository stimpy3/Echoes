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

module.exports = { generateEmbedding };
