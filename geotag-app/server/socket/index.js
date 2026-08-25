const Chat = require('../models/chat');
const Message = require('../models/message');
const logger = require('../utils/logger');

//No req.log here — socket event handlers have no HTTP request to inherit an id from.
//Same idea as the embedding worker: tag every line from this file by component instead.
const socketLogger = logger.child({ component: 'socket' });

/*
Presence now lives in Socket.IO rooms, not a local object.

Previously this file tracked `onlineUsers = { [userId]: [socketId, ...] }` as a plain JS
object and manually forEach'd over it to emit to each socket. That only ever knew about
sockets connected to THIS process — with more than one server instance behind a load
balancer, a user connected to instance B was invisible to instance A's onlineUsers, so a
message sent from instance A would silently never reach them, even after index.js's Redis
adapter was wired in. The adapter fixes cross-instance DELIVERY; it does nothing for
presence tracking that never leaves process memory in the first place.

The fix: each socket joins a room named after its own user id (`socket.join(userId)`).
Socket.IO rooms are adapter-aware — once the adapter is Redis-backed, `io.to(userId)`
reaches every socket that user has open, on any instance, with no manual bookkeeping.
Room membership is also cleaned up automatically on disconnect, which is why the old
disconnect handler (whose only job was manually pruning onlineUsers) is gone entirely.
*/

module.exports = (io) => {
  io.on("connection", (socket) => {
    //Set by the io.use() handshake middleware in server/index.js after verifying the JWT cookie.
    //Never read handshake.auth here — that is client-supplied and forgeable.
    const userId = socket.userId;

    if (userId) {
      socket.join(userId);
    }

    /*
    Persist-then-emit. This used to broadcast a message that was never written to Mongo —
    the client separately POSTed to /api/messages/sendmessage in parallel, and if THAT
    request failed, the recipient had already seen (and the sender's other tabs had already
    seen) a message that didn't actually exist anywhere, which then vanished on refresh.
    The `_id` was even faked with Date.now() rather than a real database id.

    Now: find-or-create the Chat, write the Message, update the Chat's lastMessage/
    unreadCount — same logic the old REST route had, just run here instead — and only
    THEN emit, carrying the real _id and createdAt. Nothing is shown to anyone unless it's
    actually in the database first. The REST /sendmessage route is removed (see
    messageRoutes.js) — this is now the only path that creates a message, so there's one
    place to reason about, not two racing each other.

    chatId can legitimately be absent: a brand-new conversation has no Chat document yet
    (confirmed via chatRoutes.js's mark-read route, which returns chatId: null when none
    exists). The OLD handler required chatId truthy and silently dropped the message
    otherwise — meaning a conversation's first message never broadcast live, only the
    REST call's fire-and-forget write saved it, so the recipient only saw it on next
    refresh. Falling back to a participants-based lookup (and creating the Chat if even
    that finds nothing) fixes that as a side effect of fixing the bigger problem.

    Takes an optional ack `callback` — the ORIGINATING socket doesn't receive its own
    broadcast (socket.to() below deliberately excludes it, so a single tab doesn't get its
    own message twice), so the ack is how that specific tab learns the real _id/createdAt
    to reconcile its optimistic bubble against, and how it learns whether the send actually
    succeeded at all.
    */
    socket.on("sendMessage", async ({ chatId, receiverId, message }, callback) => {
      if (!receiverId || !message) {
        if (callback) callback({ success: false, error: 'receiverId and message are required' });
        return;
      }

      let chat;
      let savedMessage;

      try {
        // Audit finding BE-016: only look up an EXISTING chat by chatId here — the
        // no-chatId "brand-new conversation" path goes through Chat.findOrCreateForPair
        // (models/chat.js), which is atomic and unique-index-backed, so two concurrent
        // first-messages between the same two users can no longer create two separate
        // Chat documents for the same pair.
        chat = chatId ? await Chat.findById(chatId) : null;

        if (!chat) {
          chat = await Chat.findOrCreateForPair(userId, receiverId);
        }

        savedMessage = await Message.create({
          chatId: chat._id,
          sender: userId,
          text: message,
        });
      } catch (err) {
        socketLogger.error({ err, userId, receiverId }, 'sendMessage failed before the message was persisted');
        if (callback) callback({ success: false, error: 'Failed to send message' });
        return;
      }

      /*
      Audit finding BE-009. Everything above this point is the one write that MUST
      succeed before anything is reported as sent — the message itself, now durably in
      Mongo. Everything below is denormalized convenience (Chat.lastMessage/
      unreadCount, read only for chat-list previews) and is deliberately NOT allowed to
      turn an already-real message into a reported failure.

      This isn't wrapped in a multi-document transaction — this app's MongoDB isn't
      provisioned as a replica set, which transactions require — so the two writes
      can't be made atomic outright. Separating them like this is what actually matters
      for correctness here, though: without it, a failure in this second step used to
      throw into the same catch as message creation and tell the client the send
      failed, even though the message had already been saved. A client that believes
      its send failed is liable to retry it — creating a genuine duplicate message,
      since nothing here deduplicates by a client-generated id. Losing a chat-list
      preview update once is a far smaller, self-healing problem: the next real message
      into this chat overwrites it regardless.

      The update itself is also now a single atomic findByIdAndUpdate ($inc/$set)
      rather than the old fetch-then-.save() — that read-modify-write let two
      concurrent messages into the SAME chat race and lose one side's unreadCount
      increment (the exact shape of bug BE-005 fixed elsewhere in this codebase); an
      $inc against the document directly can't lose a concurrent update the same way.
      */
      try {
        await Chat.findByIdAndUpdate(chat._id, {
          $set: { lastMessage: message, updatedAt: new Date() },
          $inc: { [`unreadCount.${receiverId}`]: 1 },
        });
      } catch (err) {
        socketLogger.error(
          { err, userId, receiverId, chatId: chat._id },
          'sendMessage: chat summary update failed after the message was already saved'
        );
      }

      const liveMessage = {
        _id: savedMessage._id,
        chatId: chat._id,
        sender: userId,
        text: savedMessage.text,
        readBy: savedMessage.readBy,
        createdAt: savedMessage.createdAt,
      };

      // Every socket the receiver has open, on any instance.
      io.to(receiverId).emit("newMessage", {
        ...liveMessage,
        isOwn: false
      });

      // socket.to() (unlike io.to()) automatically excludes the emitting socket —
      // this reaches the sender's OTHER open tabs; this one gets the same data via
      // the ack callback below instead, so it isn't delivered the message twice.
      socket.to(userId).emit("newMessage", {
        ...liveMessage,
        isOwn: true
      });

      if (callback) callback({ success: true, message: liveMessage });
    });

    // TYPING INDICATOR - User started typing
    socket.on("typing", ({ chatId, receiverId }) => {
      if (!receiverId) return;

      io.to(receiverId).emit("userTyping", {
        chatId,
        userId,
        isTyping: true
      });
    });

    // TYPING INDICATOR - User stopped typing
    socket.on("stopTyping", ({ chatId, receiverId }) => {
      if (!receiverId) return;

      io.to(receiverId).emit("userTyping", {
        chatId,
        userId,
        isTyping: false
      });
    });
  });
};
