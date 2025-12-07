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

module.exports = mongoose.model("Message", messageSchema);
