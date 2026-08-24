const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chat",
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    text: String,

    // for "seen" status
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound, matching the actual query in messageRoutes.js:
// Message.find({ chatId }).sort({ createdAt: 1 }) — one index serves both the filter
// and the sort, instead of a separate {chatId:1} index only covering half the query.
messageSchema.index({ chatId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
