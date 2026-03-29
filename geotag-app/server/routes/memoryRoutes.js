const express = require('express');
const router = express.Router();
const Memory = require('../models/memories');
const verifyToken = require('../middleware/verifyToken');
const { cloudinary, upload } = require('../middleware/cloudinaryConfig');
const { generateEmbeddingWithRetry } = require('../utils/embeddingHelper');

const buildProjectionStage = {
    $project: {
        _id: 1,
        title: 1,
        description: 1,
        category: 1,
        location: 1,
        photoUrl: 1,
        createdAt: 1,
        likes: 1,
        comments: 1,
        user: {
            _id: "$userDoc._id",
            name: "$userDoc.name",
            profilePic: "$userDoc.profilePic"
        }
    }
};

const escapeRegex = (input = "") => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildPrivacyMatch = (followingIds) => ({
    $match: {
        $or: [
            { "userDoc._id": { $in: followingIds } },
            { "userDoc.isPrivate": false }
        ]
    }
});

const buildRecentEligiblePipeline = ({ matchCriteria, followingIds, limit = 30 }) => ([
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
    buildPrivacyMatch(followingIds),
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    buildProjectionStage
]);

const buildLexicalPipeline = ({ matchCriteria, followingIds, searchQuery, limit = 30 }) => {
    const trimmedQuery = (searchQuery || "").trim();
    if (!trimmedQuery) return null;

    const safeRegex = new RegExp(escapeRegex(trimmedQuery), "i");
    return [
        {
            $match: {
                ...matchCriteria,
                $or: [
                    { title: safeRegex },
                    { description: safeRegex }
                ]
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userDoc"
            }
        },
        { $unwind: "$userDoc" },
        buildPrivacyMatch(followingIds),
        { $sort: { createdAt: -1 } },
        { $limit: limit },
        buildProjectionStage
    ];
};

const getAdaptiveClusterCount = (embeddingCount) => {
    if (embeddingCount >= 30) return 5;
    if (embeddingCount >= 18) return 4;
    if (embeddingCount >= 8) return 3;
    if (embeddingCount >= 3) return 2;
    return 1;
};

router.post('/creatememory', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        const userId = req.userId;
        // With multer, text fields are available in req.body
        const { title, description, location } = req.body;

        // Files uploaded to Cloudinary are in req.file
        // We use the 'path' property provided by multer-storage-cloudinary for the URL
        const photoUrl = req.file ? req.file.path : null;

        if (!photoUrl) {
            return res.status(400).json({ message: 'Memory image is required and failed to upload' });
        }

        // Location is transmitted as a string when using FormData
        let parsedLocation;
        try {
            parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
        } catch (e) {
            return res.status(400).json({ message: 'Invalid location data' });
        }

        const newMemory = new Memory({
            userId: userId,
            title: title,
            description: description,
            location: {
                type: 'Point',
                coordinates: parsedLocation.coordinates, // [lng, lat]
                address: parsedLocation.address
            },
            photoUrl: photoUrl
        });

        const savedMemory = await newMemory.save();
        
        // Respond to the user immediately for the fastest experience
        res.status(201).json({ memory: savedMemory });

        // Generate embedding in the background
        (async () => {
            try {
                const textToEmbed = `${title} ${description}`;
                const embedding = await generateEmbeddingWithRetry(textToEmbed, {
                    maxRetries: 3,
                    initialDelayMs: 300
                });
                if (embedding) {
                    await Memory.findByIdAndUpdate(savedMemory._id, { embedding });
                    console.log(`✅ Background embedding completed for memory: ${savedMemory._id}`);
                } else {
                    console.warn(`⚠️ Embedding generation failed after retries for memory: ${savedMemory._id}`);
                }
            } catch (err) {
                console.error("Background embedding failed:", err);
            }
        })();
    } catch (err) {
        console.error("Memory creation error:", err);
        res.status(500).json({ message: 'Server failed to create memory' });
    }
});

//this one is to get memories of logged-in user for MemoriesPage
router.get('/fetchmemory',verifyToken,async(req,res)=>{
    try{
        const memories= await Memory.find({userId:req.userId}).sort({createdAt:-1});
        res.status(200).json({memories});
    }
    catch(err){
       res.status(500).json({message:'server failed to fetch memories' });
    }
});





//this one is to get memories of a specific user for ProfilePage
router.get('/user/:id', async (req, res) => {
  try {
    const memories = await Memory.find({ userId: req.params.id }).sort({ createdAt: -1 });
    res.status(200).json({ memories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching user memories' });
  }
});



router.patch('/editmemory/:id', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        const memoryId = req.params.id;
        const { title, description } = req.body;

        const updateData = { title, description };

        // If a new photo is uploaded, update the photoUrl
        if (req.file) {
            // Cleanup: Try to delete the old image from Cloudinary to free space
            try {
                const oldMemory = await Memory.findOne({ _id: memoryId, userId: req.userId });
                if (oldMemory && oldMemory.photoUrl && oldMemory.photoUrl.includes('cloudinary')) {
                    const urlParts = oldMemory.photoUrl.split('/');
                    const fileNameWithExt = urlParts[urlParts.length - 1];
                    const publicId = `memories/${fileNameWithExt.split('.')[0]}`;
                    await cloudinary.uploader.destroy(publicId);
                }
            } catch (err) {
                console.error("Failed to delete old image from Cloudinary:", err);
            }
            updateData.photoUrl = req.file.path;
        }

        const updatedMemory = await Memory.findOneAndUpdate(
            { _id: memoryId, userId: req.userId },
            updateData,
            { new: true } // return the updated document
        );

        if (!updatedMemory) {
            return res.status(404).json({ message: 'Memory not found or not authorized' });
        }

        // Respond to the user immediately
        res.status(200).json({ memory: updatedMemory });

        // If title or description changed, regenerate embedding in background
        if (title || description) {
            (async () => {
                try {
                    const textToEmbed = `${title || updatedMemory.title} ${description || updatedMemory.description}`;
                    const embedding = await generateEmbeddingWithRetry(textToEmbed, {
                        maxRetries: 3,
                        initialDelayMs: 300
                    });
                    if (embedding) {
                        await Memory.findByIdAndUpdate(memoryId, { embedding });
                        console.log(`✅ Background embedding update completed for memory: ${memoryId}`);
                    } else {
                        console.warn(`⚠️ Embedding update failed after retries for memory: ${memoryId}`);
                    }
                } catch (err) {
                    console.error("Background embedding update failed:", err);
                }
            })();
        }
    } catch (err) {
        console.error("Memory edit error:", err);
        res.status(500).json({ message: 'Server failed to update memory' });
    }
});

router.delete('/deletememory/:id', verifyToken, async (req, res) => {
    try {
        const memoryId = req.params.id;
        const memory = await Memory.findOne({ _id: memoryId, userId: req.userId });

        if (!memory) {
            return res.status(404).json({ message: 'Memory not found or not authorized' });
        }

        // If it's a Cloudinary image, delete it to free space
        if (memory.photoUrl && memory.photoUrl.includes('cloudinary')) {
            try {
                const urlParts = memory.photoUrl.split('/');
                const fileNameWithExt = urlParts[urlParts.length - 1];
                const publicId = `memories/${fileNameWithExt.split('.')[0]}`;
                await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                console.error("Cloudinary image deletion failed:", err);
            }
        }

        await Memory.deleteOne({ _id: memoryId, userId: req.userId });
        res.status(200).json({ message: 'Memory and image deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server failed to delete memory' });
    }
});





router.post('/friendMemory', verifyToken, async (req, res) => {
  try {
    const mongoose = require("mongoose");

    const { userIds } = req.body;

    // Safety check
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.json([]);
    }

    // Convert string IDs → ObjectIds
    const objectIds = userIds.map(
      id => new mongoose.Types.ObjectId(id)
    );

    const result = await Memory.aggregate([
      // 1. Only memories from selected users
      {
        $match: {
          userId: { $in: objectIds }
        }
      },

      // 2. Join with users collection
      {
        $lookup: {
          from: "users",          // collection name (plural!)
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },

      // 3. Flatten user array
      {
        $unwind: "$user"
      },

      // 4. Group by user
      {
        $group: {
          _id: "$userId",
          user: {
            $first: {
              name: "$user.name",
              profilePic: "$user.profilePic"
            }
          },
          memories: {
            $push: {
              _id: "$_id",
              title: "$title",
              description: "$description",
              category: "$category",
              location: "$location",
              photoUrl: "$photoUrl",
              createdAt: "$createdAt"
            }
          }
        }
      },

      // 5. Clean final shape
      {
        $project: {
          _id: 0,
          userId: "$_id",
          user: 1,
          memories: 1
        }
      }
    ]);

    res.status(200).json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'server failed to fetch friend memories'
    });
  }
});

// Like/Unlike memory
router.post('/like/:id', verifyToken, async (req, res) => {
    try {
        const memoryId = req.params.id;
        const userId = req.userId;

        const memory = await Memory.findById(memoryId);
        if (!memory) return res.status(404).json({ message: 'Memory not found' });

        const likeIndex = memory.likes.indexOf(userId);
        if (likeIndex === -1) {
            memory.likes.push(userId);
        } else {
            memory.likes.splice(likeIndex, 1);
        }

        await memory.save();
        res.status(200).json({ likes: memory.likes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add comment
router.post('/comment/:id', verifyToken, async (req, res) => {
    try {
        const memoryId = req.params.id;
        const { text } = req.body;
        if (!text) return res.status(400).json({ message: 'Comment text is required' });

        const memory = await Memory.findById(memoryId);
        if (!memory) return res.status(404).json({ message: 'Memory not found' });

        memory.comments.push({ userId: req.userId, text });
        await memory.save();

        const populatedMemory = await Memory.findById(memoryId)
            .populate('comments.userId', 'name profilePic');
        
        const newComment = populatedMemory.comments[populatedMemory.comments.length - 1];
        res.status(201).json(newComment);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error adding comment' });
    }
});

// Fetch single memory with populated comments
router.get('/single/:id', verifyToken, async (req, res) => {
    try {
        const memory = await Memory.findById(req.params.id)
            .populate('userId', 'name profilePic')
            .populate('comments.userId', 'name profilePic');
        
        if (!memory) return res.status(404).json({ message: 'Memory not found' });
        res.status(200).json(memory);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching memory' });
    }
});

router.get('/explore', verifyToken, async (req, res) => {
    try {
        const { category, searchQuery } = req.query;
        const normalizedCategory = typeof category === 'string' ? category.trim() : '';
        const normalizedSearchQuery = typeof searchQuery === 'string' ? searchQuery.trim() : '';
        const currentUserId = req.userId;
        const mongoose = require("mongoose");
        const objectIdUser = new mongoose.Types.ObjectId(currentUserId);

        const { kMeansCluster, cosineSimilarity, averageEmbeddings } = require('../utils/embeddingHelper');
        const Follower = require('../models/follower');

        const diagnostics = {
            searchMode: Boolean(normalizedSearchQuery),
            category: normalizedCategory || null,
            historyInteractions: 0,
            interactionEmbeddings: 0,
            hasRecentLocation: false,
            streamAContentCount: 0,
            streamBGeoCount: 0,
            streamSearchLexicalCount: 0,
            fallbackCategoryCount: 0,
            fallbackRelaxedCount: 0,
            vectorError: null,
            fallbackReason: null
        };

        // 1. Get the list of users followed by the current user
        const followingdocs = await Follower.find({ follower: currentUserId });
        const followingIds = followingdocs.map(f => f.following);

        let targetEmbedding = null;
        let recentLocation = null;

        console.log(`\n--- [Hybrid Explore Engine] ---`);
        console.log(`Building profile for User: ${currentUserId}`);

        if (normalizedSearchQuery) {
            console.log(`Mode: Active Search ('${normalizedSearchQuery}')`);
            targetEmbedding = await generateEmbeddingWithRetry(normalizedSearchQuery, {
                maxRetries: 2,
                initialDelayMs: 250
            });

            if (!targetEmbedding) {
                diagnostics.fallbackReason = 'search_embedding_unavailable';
            }
        } else {
            console.log(`Mode: Passive Browsing (Mood + Geo Hybrid)`);
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

            diagnostics.historyInteractions = uniqueInteractions.length;

            console.log(`Found ${uniqueInteractions.length} unique historical interactions.`);

            // Extract embeddings
            const embeddings = uniqueInteractions
                .filter(m => m.embedding && m.embedding.length > 0)
                .map(m => m.embedding);

            diagnostics.interactionEmbeddings = embeddings.length;

            if (embeddings.length > 0) {
                // Stream A: Mood Market (Clustering)
                const clusterCount = Math.min(getAdaptiveClusterCount(embeddings.length), embeddings.length);
                const clusters = kMeansCluster(embeddings, clusterCount);
                
                // Find active mood (centroid closest to recent-interest profile)
                const recentWindow = embeddings.slice(0, Math.min(5, embeddings.length));
                const recentInterestProfile = averageEmbeddings(recentWindow) || embeddings[0];
                let bestClusterIdx = 0;
                let bestSim = -Infinity;
                
                for (let i = 0; i < clusters.length; i++) {
                    const sim = cosineSimilarity(recentInterestProfile, clusters[i]);
                    if (sim > bestSim) {
                        bestSim = sim;
                        bestClusterIdx = i;
                    }
                }
                
                targetEmbedding = clusters[bestClusterIdx];
                console.log(`[Stream A - Mood Market] Clustered history into ${clusters.length} centroids. Selected Cluster ${bestClusterIdx + 1} as active mood.`);
            }

            // Stream B: Local Explorer (Geo-Awareness)
            const mostRecentWithLoc = uniqueInteractions.find(m => m.location && m.location.coordinates && m.location.coordinates.length === 2);
            if (mostRecentWithLoc) {
                recentLocation = mostRecentWithLoc.location.coordinates;
                diagnostics.hasRecentLocation = true;
                console.log(`[Stream B - Local Explorer] Found recent location anchor: [${recentLocation[0]}, ${recentLocation[1]}]`);
            }

            if (!targetEmbedding && !recentLocation) {
                diagnostics.fallbackReason = 'no_profile_signals';
            }
        }

        const matchCriteria = {
            userId: { $ne: objectIdUser }
        };
        
        if (normalizedCategory) {
            matchCriteria.category = normalizedCategory;
        }

        // --- Stream A (Content/Vector) Pipeline ---
        let contentResults = [];
        if (targetEmbedding) {
            try {
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
                    buildPrivacyMatch(followingIds),
                    buildProjectionStage
                ];
                contentResults = await Memory.aggregate(pipelineA);
                diagnostics.streamAContentCount = contentResults.length;
                console.log(`[Stream A] Extracted ${contentResults.length} semantic matches.`);
            } catch (streamAErr) {
                diagnostics.vectorError = streamAErr.message || 'vector_search_failed';
                diagnostics.fallbackReason = diagnostics.fallbackReason || 'vector_stream_failed';
                console.warn('[Stream A] Vector search unavailable, degrading gracefully:', diagnostics.vectorError);
            }
        }

        // --- Search lexical fallback (if semantic search could not produce results) ---
        let searchFallbackResults = [];
        if (normalizedSearchQuery && contentResults.length === 0) {
            const lexicalPipeline = buildLexicalPipeline({
                matchCriteria,
                followingIds,
                searchQuery: normalizedSearchQuery,
                limit: 30
            });

            if (lexicalPipeline) {
                searchFallbackResults = await Memory.aggregate(lexicalPipeline);
                diagnostics.streamSearchLexicalCount = searchFallbackResults.length;

                if (searchFallbackResults.length > 0) {
                    diagnostics.fallbackReason = diagnostics.fallbackReason || 'lexical_search_fallback';
                }
            }
        }

        // --- Stream B (Geo) Pipeline ---
        let geoResults = [];
        if (recentLocation && !normalizedSearchQuery) {
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
                buildPrivacyMatch(followingIds),
                buildProjectionStage
            ];
            geoResults = await Memory.aggregate(pipelineB);
            diagnostics.streamBGeoCount = geoResults.length;
            console.log(`[Stream B] Extracted ${geoResults.length} localized matches within 50km.`);
        }

        // --- Blending ---
        let mergedMap = new Map();

        const streams = [contentResults, geoResults, searchFallbackResults];
        const maxLen = Math.max(...streams.map(arr => arr.length), 0);
        for (let i = 0; i < maxLen; i++) {
            for (const stream of streams) {
                if (i < stream.length && !mergedMap.has(stream[i]._id.toString())) {
                    mergedMap.set(stream[i]._id.toString(), stream[i]);
                }
            }
        }

        let finalResults = Array.from(mergedMap.values());
        console.log(`[Blending] Total unique feed generated: ${finalResults.length} memories.`);

        // --- Stream C (Fallback Ladder, strict privacy preserved) ---
        if (finalResults.length === 0) {
            console.log(`[Stream C - Fallback] No blended results. Running strict-privacy fallback ladder.`);

            const categoryFallback = await Memory.aggregate(
                buildRecentEligiblePipeline({
                    matchCriteria,
                    followingIds,
                    limit: 30
                })
            );
            diagnostics.fallbackCategoryCount = categoryFallback.length;
            finalResults = categoryFallback;

            if (finalResults.length === 0 && normalizedCategory) {
                const relaxedMatchCriteria = {
                    userId: { $ne: objectIdUser }
                };

                const relaxedFallback = await Memory.aggregate(
                    buildRecentEligiblePipeline({
                        matchCriteria: relaxedMatchCriteria,
                        followingIds,
                        limit: 30
                    })
                );

                diagnostics.fallbackRelaxedCount = relaxedFallback.length;
                finalResults = relaxedFallback;
                diagnostics.fallbackReason = diagnostics.fallbackReason || 'category_relaxed_fallback';
            }

            if (finalResults.length === 0) {
                diagnostics.fallbackReason = diagnostics.fallbackReason || 'eligible_corpus_empty';
            }
        }

        console.log('[Explore Diagnostics]', diagnostics);
        console.log('--- [End Log] ---\n');
        res.status(200).json({ memories: finalResults });
    } catch (err) {
        console.error("Explore error", err);
        res.status(500).json({ message: "Server error generating explore feed" });
    }
});

module.exports = router; 