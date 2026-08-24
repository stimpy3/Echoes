const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const Message = require("../models/message");



router.get("/:chatId", verifyToken, async (req, res) => {
  try {
    const senderId=req.userId;
    const chatId = req.params.chatId;
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 }); // oldest first
    const completeMessages = messages.map(msg => ({
    ...msg.toObject(),
    isOwn: msg.sender.toString() === senderId
    }));

    res.json(completeMessages);
  } catch (err) {
    req.log.error({ err }, 'Error fetching messages');
    res.status(500).json({ message: "Server error" });
  }
});

/*
POST /sendmessage was removed — its logic (find-or-create Chat, create Message, update
lastMessage/unreadCount) moved into the Socket.IO `sendMessage` handler (server/socket/
index.js), which now does persist-then-emit instead of the client firing this endpoint
AND a socket broadcast in parallel. Leaving this route mounted would have recreated the
same dual-write hazard through a second caller — one place creates messages now, not two
racing each other. This file keeps only the GET history route.
*/

module.exports = router;
