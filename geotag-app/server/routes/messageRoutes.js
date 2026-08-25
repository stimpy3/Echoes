const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const verifyToken = require("../middleware/verifyToken");
const { resolveLimit } = require("../utils/pagination");
const Message = require("../models/message");
const Chat = require("../models/chat");

const DEFAULT_MESSAGE_LIMIT = 200;
const MAX_MESSAGE_LIMIT = 500;

/*
Security fix (audit finding BE-001): this route used to return every message for a
`chatId` with no check that the requesting user was actually one of that chat's
participants — any authenticated user could read any two other users' conversation by
supplying an arbitrary chatId (not a secret value: both real participants already have
it from /api/chats/mychats). Now mirrors the ownership check chatRoutes.js's own
/mychats and /mark-read routes already use correctly — the fix is applying the existing
pattern here, not inventing a new one.

Also distinguishes a malformed chatId (400) from a well-formed but nonexistent one (404)
from one that exists but isn't the caller's (403) — previously a malformed id fell
through to the generic catch block as an undifferentiated 500.
*/
router.get("/:chatId", verifyToken, async (req, res) => {
  try {
    const senderId = req.userId;
    const chatId = req.params.chatId;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chat id" });
    }

    const chat = await Chat.findById(chatId).select("participants");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const isParticipant = chat.participants.some((p) => p.toString() === senderId);
    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized to view this chat" });
    }

    // BE-011 fix: fetch the most recent `limit` messages (newest first, bounded), then
    // reverse back to oldest-first — the order the client already expects — rather than
    // ever pulling a chat's entire, potentially unbounded history in one response.
    const limit = resolveLimit(req, { defaultLimit: DEFAULT_MESSAGE_LIMIT, maxLimit: MAX_MESSAGE_LIMIT });
    const messages = (await Message.find({ chatId }).sort({ createdAt: -1 }).limit(limit)).reverse();
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
