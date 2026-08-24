const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const User = require('../models/users');
const { invalidateCache } = require('../utils/cache');


router.get('/navbar', verifyToken, async (req, res) => {
 try {
  const user = await User.findById(req.userId).select('_id name email profilePic isPrivate');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
 } catch (err) {
  res.status(500).json({ message: 'Server error' });
 }
});

// Update privacy status
router.patch('/privacy', verifyToken, async (req, res) => {
  try {
    const { isPrivate } = req.body;
    const user = await User.findByIdAndUpdate(req.userId, { isPrivate }, { new: true }).select('isPrivate');
    //Key must match userRoutes.js's GET /:id cache key exactly, or the stale value keeps
    //serving until its TTL expires — this route is the only writer of that payload's fields.
    await invalidateCache(`user:${req.userId}`, req.log);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error updating privacy' });
  }
});

module.exports = router;