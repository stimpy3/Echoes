const express = require('express');
const User = require('../models/users');
const FollowRequest = require('../models/followRequest');
const Follower = require("../models/follower");
const verifyToken=require('../middleware/verifyToken');


const router=express.Router();

router.get("/suggestions", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.userId;

    // Get all the IDs that current user is already following
    const followingDocs = await Follower.find({ follower: currentUserId }).select("following");
    const followingIds = followingDocs.map(doc => doc.following);

    // Include current user id too, so we don't suggest ourselves
    followingIds.push(currentUserId);

    // Fetch users excluding the ones already followed + self
    const users = await User.find({ _id: { $nin: followingIds } })
      .select("name profilePic")
      .limit(5);

    const suggestions = await Promise.all(
      users.map(async (user) => {
        const isRequested = await FollowRequest.exists({
          sender: currentUserId,
          receiver: user._id,
        });

        return {
          _id: user._id,
          name: user.name,
          profilePic: user.profilePic,
          isRequested: !!isRequested,
        };
      })
    );

    res.status(200).json(suggestions);

  } catch (err) {
    console.error("Error fetching suggestions:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// GET /api/users/followers → all users following the logged-in user
router.get("/followers", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const followersDocs = await Follower.find({ following: currentUserId }).populate("follower", "name email profilePic");
    const followers = followersDocs.map(doc => doc.follower);
    res.json(followers);
  } catch (err) {
    console.error("Error fetching followers:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/users/following → all users the logged-in user is following
router.get("/following", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const followingDocs = await Follower.find({ follower: currentUserId }).populate("following", "name email profilePic");
    const following = followingDocs.map(doc => doc.following);
    res.json(following);
  } catch (err) {
    console.error("Error fetching following:", err);
    res.status(500).json({ message: "Server error" });
  }
});


//If you put /:id first, Express will match it BEFORE /follow-counts.
//  router.get /users/:id
//   router.get  /users/:id/follow-counts this will never be reached
//So we put follow-counts first.
router.get("/:userId/follow-counts", verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const followerCount = await Follower.countDocuments({ following: userId });
    const followingCount = await Follower.countDocuments({ follower: userId });
    
    res.json({ followerCount, followingCount });

  } catch (err) {
    console.error("Error fetching follow counts:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/status/:userId", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const profileUserId = req.params.userId;

    // Check if already following
    const isFollowing = await Follower.findOne({
      follower: currentUserId,
      following: profileUserId
    });

    // Check if request pending
    const isRequested = await FollowRequest.findOne({
      sender: currentUserId,
      receiver: profileUserId
    });

    return res.json({
      following: !!isFollowing,
      requested: !!isRequested
    });

  } catch (err) {
    console.error("Follow status check error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// GET /api/users/:id → get user by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.params.id; // ID from URL
    const user = await User.findById(userId).select('_id name email profilePic home'); 
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