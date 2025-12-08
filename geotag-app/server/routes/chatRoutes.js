const express= require('express');
const router= express.Router();
const verifyToken= require('../middleware/verifyToken');
const Chat= require('../models/chat');
const Message= require('../models/message');
const User= require('../models/users');


router.post("/mark-read/:otherUserId", verifyToken , async (req, res) => {
  const myId = req.userId;
  const otherId = req.params.otherUserId;

  try {
    const chat = await Chat.findOne({
      participants: { $all: [myId, otherId] }
    });

    if (!chat) return res.json({ success: true,chatId: null });

    // Reset unread
    chat.unreadCount.set(myId.toString(), 0);
    await chat.save();

    res.json({ success: true,chatId: chat._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});


router.get("/mychats",verifyToken, async(req,res)=>{
    try{
        const userId= req.userId;

        // Find chats where user is a participant
        const chats= await Chat.find({ participants: userId })
            .populate("participants", "name profilePic") // populate participant details
            .sort({ updatedAt: -1 }); // sort by last updated

        res.status(200).json(chats);
    }
    catch(err){
        console.error("Error fetching chats:", err);
        res.status(500).json({ message: "Server error" });
    }
}
);


module.exports=router;