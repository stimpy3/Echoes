const express = require('express');
const router = express.Router();
const Memory = require('../models/memories');
const verifyToken = require('../middleware/verifyToken');
const { upload } = require('../middleware/cloudinaryConfig');

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
        res.status(201).json({ memory: savedMemory });
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
            updateData.photoUrl = req.file.path;
        }

        // Update memory, only if it belongs to the user
        const updatedMemory = await Memory.findOneAndUpdate(
            { _id: memoryId, userId: req.userId },
            updateData,
            { new: true } // return the updated document
        );

        if (!updatedMemory) {
            return res.status(404).json({ message: 'Memory not found or not authorized' });
        }

        res.status(200).json({ memory: updatedMemory });
    } catch (err) {
        console.error("Memory edit error:", err);
        res.status(500).json({ message: 'Server failed to update memory' });
    }
});

router.delete('/deletememory/:id',verifyToken,async(req,res)=>{
    try{
        const memoryId=req.params.id;
        await Memory.deleteOne({_id:memoryId,userId:req.userId});
    }
    catch(err){
        res.status(500).json({message:'server failed to delete memory' });
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


module.exports=router;
 