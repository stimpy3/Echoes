const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const Chat = require("../models/chat");
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
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// POST /sendmessage → send a message to a user
router.post("/sendmessage", verifyToken, async (req, res) => {
  try {
    const senderId = req.userId;
    const { receiver, text } = req.body;

    if (!receiver || !text) {
      return res.status(400).json({ message: "Receiver and text are required" });
    }

    //Find existing chat
    let chat = await Chat.findOne({ participants: { $all: [senderId, receiver] } });

    //If no chat exists, create it
    if (!chat) chat = await Chat.create({ participants: [senderId, receiver] });

    // Create the message
    await Message.create({ chatId: chat._id, sender: senderId, text });

    //Update chat
    chat.lastMessage = text;
    chat.updatedAt = new Date();
    chat.unreadCount.set(receiver, (chat.unreadCount.get(receiver) || 0) + 1);
    await chat.save();

    //Return success status
    res.status(201).json({ success: true });

  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
