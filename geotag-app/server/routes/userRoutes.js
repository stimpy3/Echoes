const express = require('express');
const User = require('../models/users');
const verifyToken=require('../middleware/verifyToken');

const router=express.Router();
router.get("/suggestions",verifyToken,async(req,res)=>{
    try{
       const currentUserId = req.userId; 
       const users=await User.find({_id:{$ne:currentUserId}}).select("name profilePic").limit(5)
       res.status(200).json(users);
    }
    catch(err){
        console.error("Error fetching suggestions:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// GET /api/users/:id → get user by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.params.id; // ID from URL
    const user = await User.findById(userId).select('name email profilePic home'); 
    // You can include any other fields you want to send

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;