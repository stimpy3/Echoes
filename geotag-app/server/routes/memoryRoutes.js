const express = require('express');
const router = express.Router();
const Memory = require('../models/memories');
const verifyToken = require('../middleware/verifyToken');
const { cloudinary, upload } = require('../middleware/cloudinaryConfig');
const { generateEmbedding } = require('../utils/embeddingHelper');

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
                const embedding = await generateEmbedding(textToEmbed);
                if (embedding) {
                    await Memory.findByIdAndUpdate(savedMemory._id, { embedding });
                    console.log(`✅ Background embedding completed for memory: ${savedMemory._id}`);
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
                    const embedding = await generateEmbedding(textToEmbed);
                    if (embedding) {
                        await Memory.findByIdAndUpdate(memoryId, { embedding });
                        console.log(`✅ Background embedding update completed for memory: ${memoryId}`);
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
        const currentUserId = req.userId;
        const mongoose = require("mongoose");
        const objectIdUser = new mongoose.Types.ObjectId(currentUserId);

        const { generateEmbedding, averageEmbeddings } = require('../utils/embeddingHelper');
        const Follower = require('../models/follower');

        // 1. Get the list of users followed by the current user
        const followingdocs = await Follower.find({ follower: currentUserId });
        const followingIds = followingdocs.map(f => f.following);

        // 2. Get target embedding
        let targetEmbedding = null;
        if (searchQuery) {
            targetEmbedding = await generateEmbedding(searchQuery);
        } else {
            // Find User's own memories OR Liked memories
            const ownMemories = await Memory.find({ userId: currentUserId }).select('+embedding');
            const likedMemories = await Memory.find({ likes: currentUserId }).select('+embedding');
            
            const allEmbeddings = [...ownMemories, ...likedMemories]
                .filter(m => m.embedding && m.embedding.length > 0)
                .map(m => m.embedding);
                
            if (allEmbeddings.length > 0) {
                targetEmbedding = averageEmbeddings(allEmbeddings);
            }
        }

        const matchCriteria = {
            userId: { $ne: objectIdUser }
        };
        
        if (category) {
            matchCriteria.category = category;
        }

        let pipeline = [];
        
        if (targetEmbedding) {
            pipeline.push({
                $vectorSearch: {
                    index: "vector_index", 
                    path: "embedding",
                    queryVector: targetEmbedding,
                    numCandidates: 100,
                    limit: 50
                }
            });
        }
        
        pipeline.push({ $match: matchCriteria });
        
        // Join Users
        pipeline.push(
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
                // Visibility Rules: Must be followed user or public profile
                $match: {
                    $or: [
                        { "userDoc._id": { $in: followingIds } },
                        { "userDoc.isPrivate": false }
                    ]
                }
            }
        );

        if (!targetEmbedding) {
            // If no search vector, just sort by date
            pipeline.push({ $sort: { createdAt: -1 } });
            pipeline.push({ $limit: 30 });
        }
        
        // Format final response
        pipeline.push({
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
        });

        const results = await Memory.aggregate(pipeline);
        res.status(200).json({ memories: results });
    } catch (err) {
        console.error("Explore error", err);
        res.status(500).json({ message: "Server error generating explore feed" });
    }
});

module.exports = router; 