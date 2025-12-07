const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    lastMessage: {
        type: String,
        default: ""
    },
    unreadCount: {
        type: Map,   //key = userId, value = count
        of: Number,
        default: {}
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Chat", chatSchema);
