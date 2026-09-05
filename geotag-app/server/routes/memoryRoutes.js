const express = require('express');
const router = express.Router();
const Memory = require('../models/memories');
const User = require('../models/users');
const Follower = require('../models/follower');
const verifyToken = require('../middleware/verifyToken');
const { memoryMutationLimiter, socialActionLimiter } = require('../middleware/rateLimiter');
const { cloudinary, upload } = require('../middleware/cloudinaryConfig');
const { generateEmbeddingWithRetry } = require('../utils/embeddingHelper');
const { enqueueEmbeddingJob } = require('../queues/embeddingQueue');
const { enqueueImageEmbeddingJob } = require('../queues/imageEmbeddingQueue');
const { resolveLimit } = require('../utils/pagination');

// Audit finding BE-011 — see utils/pagination.js.
const DEFAULT_MEMORY_LIST_LIMIT = 200;
const MAX_MEMORY_LIST_LIMIT = 500;

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
            { "userDoc.isPrivate": { $ne: true } }
        ]
    }
});

/*
Security fix (audit finding BE-004). GET /single/:id, POST /like/:id, and
POST /comment/:id fetched or mutated a Memory document with no privacy/ownership check
at all — any authenticated user, any memory id, private account or not, followed or not.
Every LISTING route in this file (profile grid, Explore's three streams, all three
fallback tiers) enforces the exact same rule via buildPrivacyMatch() inside the
aggregation; GET /user/:id enforces it too, inline. This is that same rule, extracted
once so these three by-ID routes can't each reinvent (or subtly mis-invent) it.

Mirrors GET /user/:id's own inline check exactly: the owner can always act on their own
memory; otherwise, a public account's memories are visible to anyone; a private
account's are visible only to an approved follower. Writes res directly and returns a
boolean so call sites stay a two-line guard clause, matching this file's existing style.
*/
const assertCanAccessMemory = async (memoryUserId, currentUserId, res) => {
    const authorId = memoryUserId.toString();
    if (authorId === currentUserId) return true;

    const author = await User.findById(authorId).select('isPrivate');
    if (!author) {
        res.status(404).json({ message: 'Memory not found' });
        return false;
    }

    if (author.isPrivate) {
        const isFollowing = await Follower.exists({ follower: currentUserId, following: authorId });
        if (!isFollowing) {
            res.status(403).json({ message: 'This account is private' });
            return false;
        }
    }

    return true;
};

const buildGlobalPublicPipeline = ({ currentUserObjectId, limit = 30 }) => ([
    {
        $match: {
            userId: { $ne: currentUserObjectId }
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
    {
        $match: {
            "userDoc.isPrivate": { $ne: true }
        }
    },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    buildProjectionStage
]);

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

const buildReasonText = ({ source, searchQuery, category }) => {
    if (source === 'semantic_search') {
        return `Recommended because it is similar to your search: "${searchQuery}".`;
    }
    if (source === 'semantic_profile') {
        if (category) {
            return `Recommended because it matches your interests and the ${category} category.`;
        }
        return "Recommended because it matches topics you usually post, like, or engage with.";
    }
    if (source === 'geo') {
        if (category) {
            return `Recommended because it is near places you interact with and in ${category}.`;
        }
        return "Recommended because it is near places you recently interacted with.";
    }
    if (source === 'lexical_search') {
        return `Recommended because the title or description matches your search: "${searchQuery}".`;
    }
    if (source === 'fallback_category') {
        return `Recommended because it is a recent post in ${category}.`;
    }
    if (source === 'fallback_recent') {
        return "Recommended because it is a recent post from accounts you can view.";
    }
    if (source === 'fallback_public') {
        return "Recommended because it is a recent public post while we warm up your personalized feed.";
    }
    return "Recommended based on your Explore activity and available posts.";
};

const attachReason = (memories, reasonText, source) => memories.map((memory) => ({
    ...memory,
    recommendationReason: reasonText,
    recommendationSource: source
}));

router.post('/creatememory', memoryMutationLimiter, verifyToken, upload.single('photo'), async (req, res) => {
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

        // Queue embedding generation — see queues/embeddingQueue.js for why this replaced
        // an in-process fire-and-forget call. Enqueueing itself can fail (Redis briefly
        // unreachable); that's caught separately so it can't take down memory creation,
        // which has already responded to the user by this point regardless.
        try {
            const textToEmbed = `${title} ${description}`;
            await enqueueEmbeddingJob(savedMemory._id, textToEmbed);
        } catch (err) {
            req.log.error({ err, memoryId: savedMemory._id }, 'Failed to enqueue embedding job');
        }

        // Co-presence rollout, Phase 3, now wired in. Same non-blocking, already-
        // responded-to-the-user guarantee as the text embedding above — a separate
        // try/catch so a failure to enqueue this one can't be confused with, or block,
        // the text-embedding path.
        try {
            await enqueueImageEmbeddingJob(savedMemory._id, photoUrl);
        } catch (err) {
            req.log.error({ err, memoryId: savedMemory._id }, 'Failed to enqueue image embedding job');
        }
    } catch (err) {
        /*
        Bug fix (audit finding BE-006). A Mongoose ValidationError (e.g. a missing
        required field like location.address) is caused entirely by the client's own
        request — it isn't a server failure, and reporting it as one (500) hid the real
        problem from the caller. Distinguishing on err.name (Mongoose's own marker for
        this error class, not an `instanceof` check that would need importing mongoose
        into this file just for that) and returning 400 with the actual validation
        message is the same information the server already had; this just stops
        discarding it.
        */
        if (err.name === 'ValidationError') {
            req.log.warn({ err }, 'Memory creation rejected — invalid input');
            return res.status(400).json({ message: err.message });
        }
        req.log.error({ err }, 'Memory creation error');
        res.status(500).json({ message: 'Server failed to create memory' });
    }
});

//this one is to get memories of logged-in user for MemoriesPage
router.get('/fetchmemory',verifyToken,async(req,res)=>{
    try{
        const limit = resolveLimit(req, { defaultLimit: DEFAULT_MEMORY_LIST_LIMIT, maxLimit: MAX_MEMORY_LIST_LIMIT });
        const memories= await Memory.find({userId:req.userId}).sort({createdAt:-1}).limit(limit);
        res.status(200).json({memories});
    }
    catch(err){
       res.status(500).json({message:'server failed to fetch memories' });
    }
});





//this one is to get memories of a specific user for ProfilePage
router.get('/user/:id', verifyToken, async (req, res) => {
  try {
    const profileUserId = req.params.id;
    const currentUserId = req.userId;

    if (profileUserId !== currentUserId) {
        const profileUser = await User.findById(profileUserId).select('isPrivate');
        if (!profileUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (profileUser.isPrivate) {
            const isFollowing = await Follower.exists({
                follower: currentUserId,
                following: profileUserId
            });

            if (!isFollowing) {
                return res.status(403).json({ message: 'This account is private' });
            }
        }
    }

    const limit = resolveLimit(req, { defaultLimit: DEFAULT_MEMORY_LIST_LIMIT, maxLimit: MAX_MEMORY_LIST_LIMIT });
    const memories = await Memory.find({ userId: profileUserId }).sort({ createdAt: -1 }).limit(limit);
    res.status(200).json({ memories });
  } catch (err) {
    req.log.error({ err }, 'Server error fetching user memories');
    res.status(500).json({ message: 'Server error fetching user memories' });
  }
});



router.patch('/editmemory/:id', memoryMutationLimiter, verifyToken, upload.single('photo'), async (req, res) => {
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
                req.log.error({ err }, 'Failed to delete old image from Cloudinary');
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

        // If title or description changed, queue a re-embedding job (see creatememory
        // above for why this is a queue now rather than an in-process retry loop).
        if (title || description) {
            try {
                const textToEmbed = `${title || updatedMemory.title} ${description || updatedMemory.description}`;
                await enqueueEmbeddingJob(memoryId, textToEmbed);
            } catch (err) {
                req.log.error({ err, memoryId }, 'Failed to enqueue embedding update job');
            }
        }

        // Co-presence rollout, Phase 3. Only the PHOTO changing invalidates the image
        // embedding — unlike text, editing the title/description doesn't touch what's
        // actually in the picture, so re-embedding then would be pure waste.
        if (req.file) {
            try {
                await enqueueImageEmbeddingJob(memoryId, updatedMemory.photoUrl);
            } catch (err) {
                req.log.error({ err, memoryId }, 'Failed to enqueue image embedding update job');
            }
        }
    } catch (err) {
        req.log.error({ err }, 'Memory edit error');
        res.status(500).json({ message: 'Server failed to update memory' });
    }
});

router.delete('/deletememory/:id', memoryMutationLimiter, verifyToken, async (req, res) => {
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
                req.log.error({ err }, 'Cloudinary image deletion failed');
            }
        }

        await Memory.deleteOne({ _id: memoryId, userId: req.userId });
        res.status(200).json({ message: 'Memory and image deleted successfully' });
    } catch (err) {
        req.log.error({ err }, 'Server failed to delete memory');
        res.status(500).json({ message: 'Server failed to delete memory' });
    }
});





/*
Security fix (audit finding BE-017). This route used to trust `userIds` from the
request body completely — any authenticated caller could pass ANY user's id, private
account or not, followed or not, and get their full memory list back (title,
description, exact GPS coordinates, photo URL). Verified live: a stranger with zero
follow relationship to a private account retrieved that account's memories in full,
while the already-fixed BE-004 routes (`/single/:id` etc.) correctly blocked the same
stranger for the same memory. The real client (HomePage.jsx) only ever sends the
caller's own following list, but nothing server-side enforced that — this closes the
gap at the query itself, the same buildPrivacyMatch() pattern every other listing
surface in this file already uses, rather than trusting the caller's input.
*/
router.post('/friendMemory', verifyToken, async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const currentUserId = req.userId;

    const { userIds } = req.body;

    // Safety check
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.json([]);
    }

    // Convert string IDs → ObjectIds
    const objectIds = userIds.map(
      id => new mongoose.Types.ObjectId(id)
    );

    // Same trust boundary as every other listing route: a public account's memories
    // are visible to anyone, a private account's only to an approved follower (or the
    // caller viewing their own).
    const followingDocs = await Follower.find({ follower: currentUserId }).select('following');
    const followingIds = followingDocs.map(f => f.following);
    followingIds.push(new mongoose.Types.ObjectId(currentUserId));

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
          as: "userDoc"
        }
      },

      // 3. Flatten user array
      {
        $unwind: "$userDoc"
      },

      buildPrivacyMatch(followingIds),

      // 4. Group by user
      {
        $group: {
          _id: "$userId",
          user: {
            $first: {
              name: "$userDoc.name",
              profilePic: "$userDoc.profilePic"
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
    req.log.error({ err }, 'Server failed to fetch friend memories');
    res.status(500).json({
      message: 'server failed to fetch friend memories'
    });
  }
});

// Like/Unlike memory
router.post('/like/:id', socialActionLimiter, verifyToken, async (req, res) => {
    try {
        const memoryId = req.params.id;
        const userId = req.userId;

        const memory = await Memory.findById(memoryId);
        if (!memory) return res.status(404).json({ message: 'Memory not found' });
        if (!(await assertCanAccessMemory(memory.userId, userId, res))) return;

        const likeIndex = memory.likes.indexOf(userId);
        if (likeIndex === -1) {
            memory.likes.push(userId);
        } else {
            memory.likes.splice(likeIndex, 1);
        }

        await memory.save();
        res.status(200).json({ likes: memory.likes });
    } catch (err) {
        req.log.error({ err }, 'Server error toggling like');
        res.status(500).json({ message: 'Server error' });
    }
});

// Add comment
router.post('/comment/:id', socialActionLimiter, verifyToken, async (req, res) => {
    try {
        const memoryId = req.params.id;
        const { text } = req.body;
        if (!text) return res.status(400).json({ message: 'Comment text is required' });

        const memory = await Memory.findById(memoryId);
        if (!memory) return res.status(404).json({ message: 'Memory not found' });
        if (!(await assertCanAccessMemory(memory.userId, req.userId, res))) return;

        memory.comments.push({ userId: req.userId, text });
        await memory.save();

        const populatedMemory = await Memory.findById(memoryId)
            .populate('comments.userId', 'name profilePic');
        
        const newComment = populatedMemory.comments[populatedMemory.comments.length - 1];
        res.status(201).json(newComment);
    } catch (err) {
        req.log.error({ err }, 'Server error adding comment');
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
        // memory.userId is populated here (an object), unlike the like/comment routes
        // above — .populate() doesn't change the underlying _id, so this still works.
        if (!(await assertCanAccessMemory(memory.userId._id, req.userId, res))) return;

        res.status(200).json(memory);
    } catch (err) {
        req.log.error({ err }, 'Server error fetching memory');
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
            fallbackPublicCount: 0,
            vectorError: null,
            fallbackReason: null
        };

        // 1. Get the list of users followed by the current user
        const followingdocs = await Follower.find({ follower: currentUserId });
        const followingIds = followingdocs.map(f => f.following);

        let targetEmbedding = null;
        let recentLocation = null;

        req.log.info({ userId: currentUserId }, '[Explore] building profile');

        if (normalizedSearchQuery) {
            req.log.info({ searchQuery: normalizedSearchQuery }, '[Explore] mode: active search');
            targetEmbedding = await generateEmbeddingWithRetry(normalizedSearchQuery, {
                maxRetries: 2,
                initialDelayMs: 250
            });

            if (!targetEmbedding) {
                diagnostics.fallbackReason = 'search_embedding_unavailable';
            }
        } else {
            req.log.info('[Explore] mode: passive browsing (mood + geo hybrid)');
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

            req.log.info(
                { historyInteractions: uniqueInteractions.length },
                '[Explore] unique historical interactions found'
            );

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
                req.log.info(
                    { clusterCount: clusters.length, selectedCluster: bestClusterIdx + 1 },
                    '[Explore] stream A (mood market): active mood selected'
                );
            }

            // Stream B: Local Explorer (Geo-Awareness)
            const mostRecentWithLoc = uniqueInteractions.find(m => m.location && m.location.coordinates && m.location.coordinates.length === 2);
            if (mostRecentWithLoc) {
                recentLocation = mostRecentWithLoc.location.coordinates;
                diagnostics.hasRecentLocation = true;
                req.log.info(
                    { lng: recentLocation[0], lat: recentLocation[1] },
                    '[Explore] stream B (local explorer): recent location anchor found'
                );
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
                const semanticReason = buildReasonText({
                    source: normalizedSearchQuery ? 'semantic_search' : 'semantic_profile',
                    searchQuery: normalizedSearchQuery,
                    category: normalizedCategory
                });
                contentResults = attachReason(contentResults, semanticReason, normalizedSearchQuery ? 'semantic_search' : 'semantic_profile');
                diagnostics.streamAContentCount = contentResults.length;
                req.log.info(
                    { streamAContentCount: contentResults.length },
                    '[Explore] stream A: semantic matches extracted'
                );
            } catch (streamAErr) {
                diagnostics.vectorError = streamAErr.message || 'vector_search_failed';
                diagnostics.fallbackReason = diagnostics.fallbackReason || 'vector_stream_failed';
                req.log.warn(
                    { err: streamAErr },
                    '[Explore] stream A: vector search unavailable, degrading gracefully'
                );
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
                searchFallbackResults = attachReason(
                    searchFallbackResults,
                    buildReasonText({ source: 'lexical_search', searchQuery: normalizedSearchQuery }),
                    'lexical_search'
                );
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
            geoResults = attachReason(
                geoResults,
                buildReasonText({ source: 'geo', category: normalizedCategory }),
                'geo'
            );
            diagnostics.streamBGeoCount = geoResults.length;
            req.log.info(
                { streamBGeoCount: geoResults.length },
                '[Explore] stream B: localized matches extracted (50km)'
            );
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
        req.log.info({ feedSize: finalResults.length }, '[Explore] blending: unique feed generated');

        // --- Stream C (Fallback Ladder, strict privacy preserved) ---
        if (finalResults.length === 0) {
            req.log.warn('[Explore] no blended results, running strict-privacy fallback ladder');

            const categoryFallback = await Memory.aggregate(
                buildRecentEligiblePipeline({
                    matchCriteria,
                    followingIds,
                    limit: 30
                })
            );
            diagnostics.fallbackCategoryCount = categoryFallback.length;
            finalResults = attachReason(
                categoryFallback,
                buildReasonText({
                    source: normalizedCategory ? 'fallback_category' : 'fallback_recent',
                    category: normalizedCategory
                }),
                normalizedCategory ? 'fallback_category' : 'fallback_recent'
            );

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
                finalResults = attachReason(
                    relaxedFallback,
                    buildReasonText({ source: 'fallback_recent' }),
                    'fallback_recent'
                );
                diagnostics.fallbackReason = diagnostics.fallbackReason || 'category_relaxed_fallback';
            }

            if (finalResults.length === 0) {
                const publicFallback = await Memory.aggregate(
                    buildGlobalPublicPipeline({
                        currentUserObjectId: objectIdUser,
                        limit: 30
                    })
                );

                diagnostics.fallbackPublicCount = publicFallback.length;
                finalResults = attachReason(
                    publicFallback,
                    buildReasonText({ source: 'fallback_public' }),
                    'fallback_public'
                );

                if (finalResults.length > 0) {
                    diagnostics.fallbackReason = diagnostics.fallbackReason || 'public_global_fallback';
                } else {
                    diagnostics.fallbackReason = diagnostics.fallbackReason || 'eligible_corpus_empty';
                }
            }
        }

        // Spread rather than nest so every field (fallbackReason, vectorError, the per-
        // stream counts, ...) is individually queryable in log-aggregation tooling — e.g.
        // "show me every request where fallbackReason = vector_stream_failed" — instead of
        // being buried one level down inside an opaque "diagnostics" object.
        req.log.info({ ...diagnostics, resultCount: finalResults.length }, '[Explore] request complete');
        res.status(200).json({ memories: finalResults });
    } catch (err) {
        req.log.error({ err }, '[Explore] request failed');
        res.status(500).json({ message: "Server error generating explore feed" });
    }
});

module.exports = router; 