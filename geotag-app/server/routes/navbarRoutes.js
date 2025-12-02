const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const User = require('../models/users');


router.get('/navbar', verifyToken, async (req, res) => {
 const nameEmailPfp=await User.findById(req.userId).select('_id name email profilePic');//select oly these fields, select('-password') would mean only exclude password
 if (!nameEmailPfp) return res.status(404).json({ message: 'User not found' });
 //404 mans could not find resource requested by client
  res.json(nameEmailPfp);
});

module.exports = router;