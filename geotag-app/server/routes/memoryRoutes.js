const express=require('express');
const router=express.Router();
const Memory=require('../models/memories');
const verifyToken=require('../middleware/verifyToken');

router.post('/creatememory',verifyToken,async(req,res)=>{
    try{
        const userId=req.userId;//we got userId from verifyToken middleware
        const { title, description, location, photoUrl } = req.body;

         // Create a new Memory document
        const newMemory = new Memory({
            userId: userId,
            title:title,
            description:description,
            location: {
              type: 'Point',
              coordinates: location.coordinates, // [lng, lat]
              address: location.address
            },
            photoUrl:photoUrl
            //no need to set createdAt, defaults to now() as long as defined in schema
          });

        const savedMemory = await newMemory.save();
         //created status code is 201
         res.status(201).json({ memory: savedMemory });
    }
    catch(err){
       res.status(500).json({message:'server failed to create memory'});
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



router.patch('/editmemory/:id',verifyToken,async(req,res)=>{
    try{
        const memoryId = req.params.id;
         const { title, description } = req.body;
     
         // Update memory, only if it belongs to the user
         const updatedMemory = await Memory.findOneAndUpdate(
           { _id: memoryId, userId: req.userId },
           { title, description },
           { new: true } // return the updated document
         );
     
         if (!updatedMemory) {
           return res.status(404).json({ message: 'Memory not found or not authorized' });
         }
     
         res.status(200).json({ memory: updatedMemory });    
        }
       catch(err){
        res.status(500).json({message:'server failed to delete memory' });
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
 