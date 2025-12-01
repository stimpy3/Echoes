const express=require('express');
const router=express.Router();
const verifyToken=require('../middleware/verifyToken');
const FollowRequest = require("../models/followRequest");
const Follower = require("../models/follower");


router.post("/request", verifyToken, async (req, res) => {
  try {
    const sender = req.userId; //logged in user
    const { receiverId } = req.body;

    // Safety: cannot request yourself
    if (sender === receiverId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    // Try finding existing request
    const existing = await FollowRequest.findOne({ sender, receiver: receiverId });

    if (existing) {//toggle request
      // Request exists → remove it (cancel request)
      await FollowRequest.deleteOne({ sender, receiver: receiverId });
      return res.status(200).json({ requested: false, message: "Request cancelled" });
    }

    //No request → create one
    await FollowRequest.create({ sender, receiver: receiverId });

    return res.status(200).json({ requested: true, message: "Request sent" });
  } 
  
  catch (err) {
    console.error(err);

    // Handle duplicate (index violation)
    if (err.code === 11000) {
      return res.status(400).json({ message: "Request already exists" });
    }

    res.status(500).json({ message: "Server error" });
  }
});



router.get("/notifications", verifyToken, async (req, res) => {
  try {
    const receiverId = req.userId;

    const requests = await FollowRequest.find({ receiver: receiverId })
      .populate("sender", "name profilePic")
      .select("sender createdAt"); // explicitly include createdAt

    return res.status(200).json(requests);
  } catch (err) {
    console.error("Notification fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/notifications/:id", verifyToken, async (req, res) => {
  try {
    const receiverId = req.userId;
    const notifId = req.params.id;

    // Only allow deleting if it's *their* notification
    const deleted = await FollowRequest.findOneAndDelete({
      _id: notifId,
      receiver: receiverId,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification removed" });
  } catch (err) {
    console.error("Delete notif error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.post("/confirm", verifyToken, async (req, res) => {
  try {
    const receiverId = req.userId;     // the logged-in user
    const { senderId } = req.body;     // who sent the request

    // Check if the follow request actually exists
    const request = await FollowRequest.findOne({
      sender: senderId,
      receiver: receiverId,
    });

    if (!request) {
      return res.status(404).json({ message: "Follow request not found" });
    }

    // Create follower entry (sender follows receiver)
    await Follower.create({
      follower: senderId,
      following: receiverId,
    });

    // Delete the follow request after accepting
    await FollowRequest.findByIdAndDelete(request._id);

    res.status(200).json({ message: "Follow request accepted" });
  } catch (err) {
    console.error("Error confirming follow:", err);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;
