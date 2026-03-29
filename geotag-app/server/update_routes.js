const fs = require('fs');
const filepath = 'c:/Users/SOHAN/Desktop/Echoes/geotag-app/server/routes/memoryRoutes.js';
let code = fs.readFileSync(filepath, 'utf8');

const startMarker = "router.get('/explore', verifyToken, async (req, res) => {";
const endMarker = "module.exports = router;";

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find markers");
    process.exit(1);
}

const replacement = `router.get('/explore', verifyToken, async (req, res) => {
    try {
        const { category, searchQuery } = req.query;
        const currentUserId = req.userId;
        const mongoose = require("mongoose");
        const objectIdUser = new mongoose.Types.ObjectId(currentUserId);

        const { generateEmbedding, kMeansCluster, cosineSimilarity } = require('../utils/embeddingHelper');
        const Follower = require('../models/follower');

        // 1. Get the list of users followed by the current user
        const followingdocs = await Follower.find({ follower: currentUserId });
        const followingIds = followingdocs.map(f => f.following);

        let targetEmbedding = null;
        let recentLocation = null;

        console.log(\`\\n--- [Hybrid Explore Engine] ---\`);
        console.log(\`Building profile for User: \${currentUserId}\`);

        if (searchQuery) {
            console.log(\`Mode: Active Search ('\${searchQuery}')\`);
            targetEmbedding = await generateEmbedding(searchQuery);
        } else {
            console.log(\`Mode: Passive Browsing (Mood + Geo Hybrid)\`);
            // Find User's own memories OR Liked memories
            const ownMemories = await Memory.find({ userId: currentUserId }).select('+embedding').sort({ createdAt: -1 });
            const likedMemories = await Memory.find({ likes: currentUserId }).select('+embedding').sort({ createdAt: -1 });
            
            // Combine and sort descending by time
            const allInteractions = [...ownMemories, ...likedMemories]
                .sort((a, b) => b.createdAt - a.createdAt);

            // Deduplicate interactions 
            const uniqueInteractions = [];
            const seenIds = new Set();
            for (const m of allInteractions) {
                if (!seenIds.has(m._id.toString())) {
                    uniqueInteractions.push(m);
                    seenIds.add(m._id.toString());
                }
            }

            console.log(\`Found \${uniqueInteractions.length} unique historical interactions.\`);

            // Extract embeddings
            const embeddings = uniqueInteractions
                .filter(m => m.embedding && m.embedding.length > 0)
                .map(m => m.embedding);

            if (embeddings.length > 0) {
                // Stream A: Mood Market (Clustering)
                const clusters = kMeansCluster(embeddings, 3); 
                
                // Find active mood (centroid closest to the most recent interaction)
                const mostRecentEmbedding = embeddings[0];
                let bestClusterIdx = 0;
                let bestSim = -Infinity;
                
                for (let i = 0; i < clusters.length; i++) {
                    const sim = cosineSimilarity(mostRecentEmbedding, clusters[i]);
                    if (sim > bestSim) {
                        bestSim = sim;
                        bestClusterIdx = i;
                    }
                }
                
                targetEmbedding = clusters[bestClusterIdx];
                console.log(\`[Stream A - Mood Market] Clustered history into \${clusters.length} centroids. Selected Cluster \${bestClusterIdx + 1} as active mood.\`);
            }

            // Stream B: Local Explorer (Geo-Awareness)
            const mostRecentWithLoc = uniqueInteractions.find(m => m.location && m.location.coordinates && m.location.coordinates.length === 2);
            if (mostRecentWithLoc) {
                recentLocation = mostRecentWithLoc.location.coordinates;
                console.log(\`[Stream B - Local Explorer] Found recent location anchor: [\${recentLocation[0]}, \${recentLocation[1]}]\`);
            }
        }

        const matchCriteria = {
            userId: { $ne: objectIdUser }
        };
        
        if (category) {
            matchCriteria.category = category;
        }

        // --- Stream A (Content/Vector) Pipeline ---
        let contentResults = [];
        if (targetEmbedding) {
            let pipelineA = [
                {
                    $vectorSearch: {
                        index: "vector_index", 
                        path: "embedding",
                        queryVector: targetEmbedding,
                        numCandidates: 100,
                        limit: 30
                    }
                },
                { $match: matchCriteria },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "userDoc"
                    }
                },
                { $unwind: "$userDoc" },
                {
                    $match: {
                        $or: [
                            { "userDoc._id": { $in: followingIds } },
                            { "userDoc.isPrivate": false }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1, title: 1, description: 1, category: 1, location: 1,
                        photoUrl: 1, createdAt: 1, likes: 1, comments: 1,
                        user: { _id: "$userDoc._id", name: "$userDoc.name", profilePic: "$userDoc.profilePic" }
                    }
                }
            ];
            contentResults = await Memory.aggregate(pipelineA);
            console.log(\`[Stream A] Extracted \${contentResults.length} semantic matches.\`);
        }

        // --- Stream B (Geo) Pipeline ---
        let geoResults = [];
        if (recentLocation && !searchQuery) {
            let pipelineB = [
                {
                    $geoNear: {
                        near: { type: "Point", coordinates: recentLocation },
                        distanceField: "dist.calculated",
                        maxDistance: 50000,
                        spherical: true,
                        query: matchCriteria
                    }
                },
                { $limit: 20 },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "userDoc"
                    }
                },
                { $unwind: "$userDoc" },
                {
                    $match: {
                        $or: [
                            { "userDoc._id": { $in: followingIds } },
                            { "userDoc.isPrivate": false }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1, title: 1, description: 1, category: 1, location: 1,
                        photoUrl: 1, createdAt: 1, likes: 1, comments: 1,
                        user: { _id: "$userDoc._id", name: "$userDoc.name", profilePic: "$userDoc.profilePic" }
                    }
                }
            ];
            geoResults = await Memory.aggregate(pipelineB);
            console.log(\`[Stream B] Extracted \${geoResults.length} localized matches within 50km.\`);
        }

        // --- Blending ---
        let mergedMap = new Map();
        
        let maxLen = Math.max(contentResults.length, geoResults.length);
        for(let i = 0; i < maxLen; i++){
            if(i < contentResults.length && !mergedMap.has(contentResults[i]._id.toString())){
                mergedMap.set(contentResults[i]._id.toString(), contentResults[i]);
            }
            if(i < geoResults.length && !mergedMap.has(geoResults[i]._id.toString())){
                mergedMap.set(geoResults[i]._id.toString(), geoResults[i]);
            }
        }

        let finalResults = Array.from(mergedMap.values());
        console.log(\`[Blending] Total unique feed generated: \${finalResults.length} memories.\`);

        // --- Stream C (Fallback) ---
        if (finalResults.length === 0) {
            console.log(\`[Stream C - Fallback] No recommendations found. Fetching recent public posts.\`);
            const fallbackPipeline = [
                { $match: matchCriteria },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "userDoc"
                    }
                },
                { $unwind: "$userDoc" },
                { $match: { "userDoc.isPrivate": false } },
                { $sort: { createdAt: -1 } },
                { $limit: 30 },
                {
                    $project: {
                        _id: 1, title: 1, description: 1, category: 1, location: 1,
                        photoUrl: 1, createdAt: 1, likes: 1, comments: 1,
                        user: { _id: "$userDoc._id", name: "$userDoc.name", profilePic: "$userDoc.profilePic" }
                    }
                }
            ];
            finalResults = await Memory.aggregate(fallbackPipeline);
        }

        console.log('--- [End Log] ---\\n');
        res.status(200).json({ memories: finalResults });
    } catch (err) {
        console.error("Explore error", err);
        res.status(500).json({ message: "Server error generating explore feed" });
    }
});

`;

const newCode = code.substring(0, startIdx) + replacement + code.substring(endIdx);
fs.writeFileSync(filepath, newCode);
console.log("Done");
