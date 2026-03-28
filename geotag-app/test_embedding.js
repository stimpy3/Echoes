const { generateEmbedding } = require('./server/utils/embeddingHelper');

async function test() {
    console.log('Generating embedding for: "Beach Sunset A beautiful day at the beach"');
    const embedding = await generateEmbedding('Beach Sunset A beautiful day at the beach');
    if (embedding && Array.isArray(embedding)) {
        console.log('Embedding generated successfully!');
        console.log('Length:', embedding.length);
        console.log('First 5 values:', embedding.slice(0, 5));
        process.exit(0);
    } else {
        console.error('Failed to generate embedding.');
        process.exit(1);
    }
}

test();
