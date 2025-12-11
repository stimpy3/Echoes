const onlineUsers = {};

/*
-io is the boss.
-socket is one employee.

-io manages everyone
-socket is a specific person connected to the server

io.on("connection", (socket) => {})
“Whenever someone connects to the server, give me THAT user's socket
So socket ONLY exists inside that connection.

socket.on(...) Because once the user is connected,
you want to listen to events FROM THAT PERSON.
 */

module.exports = (io) => {
  //io.on(...) = When ANY user connects
  //socket.on(...) = When THIS user does something
  io.on("connection", (socket) => {
    // console.log("Socket connected:", socket.id);

    const userId = socket.handshake.auth.userId;

    if (userId) {
      if (!onlineUsers[userId]) onlineUsers[userId] = [];//if new online user create array for that user
      onlineUsers[userId].push(socket.id); //when the same online user opens a new tab
    }

    socket.on("disconnect", () => {
      if (userId && onlineUsers[userId]) {
        onlineUsers[userId] = onlineUsers[userId].filter(id => id !== socket.id);

        if (onlineUsers[userId].length === 0) {
          //delete is a JavaScript operator used to remove a property from an object.
          /*  
               onlineUsers = {
                   "123": ["socketID1", "socketID2"],
                   "456": ["socketIdx"]
                }
                delete onlineUsers["123"] would remove that property from the object
           */
          delete onlineUsers[userId];
        }
      }
    });

    /*If this user emits sendMessage from the frontend,
    the server will receive it here.*/
    socket.on("sendMessage", async ({ chatId, receiverId, message }) => {  // Changed 'text' to 'message'
        if (!chatId || !receiverId || !message) return;
      
      //   console.log("BACKEND RECEIVED:", { chatId, receiverId, message, from: userId });
      
        // 1. Construct LIVE message with isOwn flag
        const liveMessage = {
          _id: new Date().getTime(),
          chatId,
          sender: userId,
          text: message,  //Store as 'text' for consistency
          readBy: [userId],
          createdAt: new Date(),
        };
      
        // 2. Emit to RECEIVER (mark as NOT own)
        const receiverSockets = onlineUsers[receiverId] || [];
        receiverSockets.forEach(id => {
          io.to(id).emit("newMessage", {
            ...liveMessage,
            isOwn: false  //missed this last time
          });
        });
      
        // 3. Emit to SENDER (mark as own, but skip the socket that sent it)
        const senderSockets = onlineUsers[userId] || [];
        senderSockets.forEach(id => {
          if (id !== socket.id) {  // ✅ ADD THIS CHECK - Don't send back to same socket
            io.to(id).emit("newMessage", {
              ...liveMessage,
              isOwn: true  // ✅ ADD THIS
            });
          }
        });
      
      //   console.log(`Sent to ${receiverSockets.length} receiver sockets and ${senderSockets.length - 1} sender sockets`);
    });




    
    // ✅ TYPING INDICATOR - User started typing
    socket.on("typing", ({ chatId, receiverId }) => {
      if (!receiverId) return;
      
      console.log(`User ${userId} is typing to ${receiverId} in chat ${chatId}`);
      
      const receiverSockets = onlineUsers[receiverId] || [];
      receiverSockets.forEach(id => {
        io.to(id).emit("userTyping", {
          chatId,
          userId,
          isTyping: true
        });
      });
    });

    // ✅ TYPING INDICATOR - User stopped typing
    socket.on("stopTyping", ({ chatId, receiverId }) => {
      if (!receiverId) return;
      
      console.log(`User ${userId} stopped typing to ${receiverId} in chat ${chatId}`);
      
      const receiverSockets = onlineUsers[receiverId] || [];
      receiverSockets.forEach(id => {
        io.to(id).emit("userTyping", {
          chatId,
          userId,
          isTyping: false
        });
      });
    });





  });
};

