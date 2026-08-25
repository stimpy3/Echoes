const express = require('express');
const User = require('../models/users');
const FollowRequest = require('../models/followRequest');
const Follower = require("../models/follower");
const verifyToken=require('../middleware/verifyToken');
const { getOrSetCache } = require('../utils/cache');
const { resolveLimit } = require('../utils/pagination');

// Audit finding BE-011 — see utils/pagination.js.
const DEFAULT_FOLLOW_LIST_LIMIT = 200;
const MAX_FOLLOW_LIST_LIMIT = 500;

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
    req.log.error({ err }, 'Error fetching suggestions');
    res.status(500).json({ message: "Server error" });
  }
});


// GET /api/users/followers → all users following the logged-in user
router.get("/followers", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const limit = resolveLimit(req, { defaultLimit: DEFAULT_FOLLOW_LIST_LIMIT, maxLimit: MAX_FOLLOW_LIST_LIMIT });
    const followersDocs = await Follower.find({ following: currentUserId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("follower", "name email profilePic");
    const followers = followersDocs.map(doc => doc.follower);
    res.json(followers);
  } catch (err) {
    req.log.error({ err }, 'Error fetching followers');
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/users/following → all users the logged-in user is following
router.get("/following", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const limit = resolveLimit(req, { defaultLimit: DEFAULT_FOLLOW_LIST_LIMIT, maxLimit: MAX_FOLLOW_LIST_LIMIT });
    const followingDocs = await Follower.find({ follower: currentUserId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("following", "name email profilePic");
    const following = followingDocs.map(doc => doc.following);
    res.json(following);
  } catch (err) {
    req.log.error({ err }, 'Error fetching following');
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
    req.log.error({ err }, 'Error fetching follow counts');
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/status/:userId", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const profileUserId = req.params.userId;

    const profileUser = await User.findById(profileUserId).select("isPrivate");
    if (!profileUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if already following
    const isFollowing = await Follower.findOne({
      follower: currentUserId,
      following: profileUserId
    });

    // Public accounts should never show request state.
    if (!profileUser.isPrivate) {
      return res.json({
        following: !!isFollowing,
        requested: false
      });
    }

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
    req.log.error({ err }, 'Follow status check error');
    res.status(500).json({ message: "Server error" });
  }
});


/*
Security fix (audit finding BE-018). This route used to select and return `email` and
`home` for ANY user id to ANY authenticated caller, with no privacy or follow check at
all — verified live: a stranger with zero follow relationship to a PRIVATE account
retrieved that account's exact home GPS coordinates and email address, both with a
plain 200. `home` in particular is dead weight for this route specifically: grep
confirms the client (ProfilePage.jsx) never reads `user.home` from this response at
all — a viewer's own home for centering THEIR OWN map already comes from the correctly
self-scoped GET /api/user/gethome. There is no legitimate reason for this endpoint to
ever return anyone's home coordinates but their own, regardless of public/private.

Split into two pieces because of the cache: the cached, viewer-agnostic base payload
(name/profilePic/isPrivate) is safe for anyone to see about anyone — matches the
"identity is visible even for a private account, only its CONTENT is gated" model this
app already uses everywhere else (you can see a private account's name/pic and follow-
request them, the same way findEligibleMutualPairs, buildPrivacyMatch, etc. all treat
identity vs. content differently). `email` depends on the SPECIFIC caller's relationship
to this user, so it can't live in a cache key shared by every viewer — computed fresh
per request instead, included only for the owner, an approved follower, or any viewer
of a public account (matching this app's existing "public = visible to anyone" contract
for every other content type). `home` is simply never included for anyone but the owner.
*/
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.params.id; // ID from URL
    const currentUserId = req.userId;
    const isOwner = userId === currentUserId;

    const basePayload = await getOrSetCache(`user:${userId}`, 300, async () => {
      let user = await User.findById(userId).select('_id name profilePic isPrivate');

      if (!user) return null;

      // Backfill older documents that do not have isPrivate yet
      if (typeof user.isPrivate === 'undefined') {
        await User.updateOne({ _id: userId }, { $set: { isPrivate: false } });
        user = await User.findById(userId).select('_id name profilePic isPrivate');
      }

      const obj = user.toObject();
      obj.isPrivate = Boolean(obj.isPrivate);
      return obj;
    }, req.log);

    if (!basePayload) {
      return res.status(404).json({ message: 'User not found' });
    }

    const payload = { ...basePayload };

    if (isOwner) {
      const self = await User.findById(userId).select('email home');
      payload.email = self.email;
      payload.home = self.home;
    } else if (!basePayload.isPrivate) {
      const publicUser = await User.findById(userId).select('email');
      payload.email = publicUser.email;
    } else {
      const isFollowing = await Follower.exists({ follower: currentUserId, following: userId });
      if (isFollowing) {
        const followedUser = await User.findById(userId).select('email');
        payload.email = followedUser.email;
      }
    }

    res.status(200).json(payload);
  } catch (err) {
    req.log.error({ err }, 'Error fetching user');
    res.status(500).json({ message: 'Server error' });
  }
});




module.exports = router;