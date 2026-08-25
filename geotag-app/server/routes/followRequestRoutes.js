const express=require('express');
const router=express.Router();
const verifyToken=require('../middleware/verifyToken');
const { socialActionLimiter } = require('../middleware/rateLimiter');
const { resolveLimit } = require('../utils/pagination');
const User = require("../models/users");
const FollowRequest = require("../models/followRequest");
const Follower = require("../models/follower");

// Audit finding BE-011 — see utils/pagination.js.
const DEFAULT_NOTIFICATION_LIMIT = 100;
const MAX_NOTIFICATION_LIMIT = 300;


router.post("/request", socialActionLimiter, verifyToken, async (req, res) => {
  try {
    const sender = req.userId; //logged in user
    const { receiverId } = req.body;

    // Safety: cannot request yourself
    if (sender === receiverId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const receiverUser = await User.findById(receiverId).select("isPrivate");
    if (!receiverUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Public accounts: follow directly, no request state.
    if (!receiverUser.isPrivate) {
      await Follower.updateOne(
        { follower: sender, following: receiverId },
        { $setOnInsert: { follower: sender, following: receiverId } },
        { upsert: true }
      );

      // Remove stale request if one exists from older behavior.
      await FollowRequest.deleteOne({ sender, receiver: receiverId });

      return res.status(200).json({ following: true, requested: false, message: "Followed" });
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
    req.log.error({ err }, 'Error creating follow request');

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
    const limit = resolveLimit(req, { defaultLimit: DEFAULT_NOTIFICATION_LIMIT, maxLimit: MAX_NOTIFICATION_LIMIT });

    const requests = await FollowRequest.find({ receiver: receiverId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", "name profilePic")
      .select("sender createdAt"); // explicitly include createdAt

    return res.status(200).json(requests);
  } catch (err) {
    req.log.error({ err }, 'Notification fetch error');
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/notifications/:id", socialActionLimiter, verifyToken, async (req, res) => {
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
    req.log.error({ err }, 'Delete notification error');
    res.status(500).json({ message: "Server error" });
  }
});


router.post("/confirm", socialActionLimiter, verifyToken, async (req, res) => {
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
    try {
      await Follower.create({
        follower: senderId,
        following: receiverId,
      });
    } catch (err) {
      // Concurrency fix (audit finding BE-007): two concurrent /confirm calls for the
      // same request (a retried request, a double-tap) can both read the FollowRequest
      // above before either deletes it, then both attempt to create the same Follower
      // row. The Follower schema's unique index on {follower, following} (models/
      // follower.js) correctly lets only one succeed — but the second request threw
      // that as an unhandled 11000 straight into the generic catch below, returning a
      // 500 for a request whose actual intent (being followed) had already succeeded.
      // A duplicate-key error here means someone already has this exact relationship,
      // which is exactly what this request wanted — idempotent success, not a failure.
      if (err.code !== 11000) throw err;
    }

    // Delete the follow request after accepting
    await FollowRequest.findByIdAndDelete(request._id);

    res.status(200).json({ message: "Follow request accepted" });
  } catch (err) {
    req.log.error({ err }, 'Error confirming follow');
    res.status(500).json({ message: "Server error" });
  }
});



//unfollow
router.post("/unfollow", socialActionLimiter, verifyToken, async (req, res) => {
  try {
    const currentUserId = req.userId; // from verifyToken
    const { receiverId } = req.body; // user to unfollow

    if (!receiverId) {
      return res.status(400).json({ message: "Receiver ID is required" });
    }

    // Remove the follower entry
    const deleted = await Follower.findOneAndDelete({
      follower: currentUserId,
      following: receiverId,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Follow relationship not found" });
    }

    return res.json({ message: "Unfollowed successfully" });
  } catch (err) {
    req.log.error({ err }, 'Unfollow error');
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;
