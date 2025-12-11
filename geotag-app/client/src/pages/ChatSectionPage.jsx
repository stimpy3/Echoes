import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { formatTime } from "../utils/formatTime";
import { formatDDMMYY } from "../utils/formatDDMMYY";
import { socket } from "../utils/socket";
import axios from "axios";

const ChatSectionPage = ({ 
  refreshChats, 
  chatId, 
  receiverId, 
  receiverName, 
  receiverProfilePic,
  myId 
}) => {
  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);  // ✅ Track if other user is typing
  const textareaRef = useRef();
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);  // ✅ For debouncing
  const navigate = useNavigate();

  const handleInput = (e) => {
    const ta = e.target;
    ta.style.height = "40px";
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";

    // ✅ TYPING INDICATOR: Emit typing event
    socket.emit("typing", { chatId, receiverId });

    // ✅ Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // ✅ Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", { chatId, receiverId });
    }, 2000);
  };

  const goToProfile = (userId) => navigate(`/profile/${userId}`);

  const sendMessage = async () => {
    const text = textareaRef.current.value.trim();
    if (!text) return;

    textareaRef.current.value = "";
    textareaRef.current.style.height = "40px";

    // ✅ Stop typing indicator when sending
    socket.emit("stopTyping", { chatId, receiverId });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const optimisticMessage = {
      _id: Date.now(),
      text,
      isOwn: true,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, optimisticMessage]);

    socket.emit("sendMessage", {
      message: text,
      chatId,
      receiverId,
    });

    console.log("FRONTEND SENT:", { message: text, chatId, receiverId });

    try {
      await axios.post(
        `${BASE_URL}/api/messages/sendmessage`,
        {
          receiver: receiverId,
          text
        },
        { withCredentials: true }
      );
      refreshChats();
    } catch (err) {
      console.error("Error sending message:", err);
      setMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isTyping]);  // ✅ Also scroll when typing indicator appears

  // Fetch messages when chat changes
  useEffect(() => {
    setMessages([]);
    setIsTyping(false);  // ✅ Reset typing on chat change
    
    if (!chatId) return;

    const getMessages = async (chatId) => {
      try {
        const res = await axios.get(`${BASE_URL}/api/messages/${chatId}`, {
          withCredentials: true
        });
        setMessages(res.data);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    getMessages(chatId);
  }, [chatId]);

  // Listen for new messages
  useEffect(() => {
    const handleNewMessage = (msg) => {
      console.log("LIVE MESSAGE RECEIVED:", msg);
      
      if (msg.chatId === chatId) {
        setMessages(prev => {
          const exists = prev.some(m => 
            m._id === msg._id || 
            (m.text === msg.text && Math.abs(new Date(m.createdAt) - new Date(msg.createdAt)) < 1000)
          );
          
          if (exists) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [chatId]);

  // ✅ LISTEN FOR TYPING INDICATOR
  useEffect(() => {
    const handleUserTyping = ({ chatId: typingChatId, userId: typingUserId, isTyping: typing }) => {
      // Only show typing if it's for THIS chat and from the OTHER user
      if (typingChatId === chatId && typingUserId === receiverId) {
        setIsTyping(typing);
        console.log(`${receiverName} is ${typing ? 'typing' : 'not typing'}`);
      }
    };

    socket.on("userTyping", handleUserTyping);

    return () => {
      socket.off("userTyping", handleUserTyping);
    };
  }, [chatId, receiverId, receiverName]);

  // ✅ Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const isDifferentDay = (msg1, msg2) => {
    if (!msg1 || !msg2) return true;

    const d1 = new Date(msg1.createdAt);
    const d2 = new Date(msg2.createdAt);

    return (
      d1.getFullYear() !== d2.getFullYear() ||
      d1.getMonth() !== d2.getMonth() ||
      d1.getDate() !== d2.getDate()
    );
  };

  return (
    <div className="relative flex flex-col w-full h-screen overflow-hidden bg-lightMain dark:bg-dfadeColor">
      <section className="w-full bg-main dark:bg-dmain h-[50px] p-[10px] flex items-center">
        <button className="h-fit w-fit flex" onClick={() => goToProfile(receiverId)}>
          <div className="h-fit w-fit mr-[10px]">
            {receiverProfilePic ? (
              <img
                src={receiverProfilePic}
                alt="pfp"
                className="w-[30px] border-borderColor h-[30px] rounded-full object-cover"
              />
            ) : (
              <div className="aspect-square min-w-[30px] border-[1px] bg-gray-400 dark:bg-[#393939] dark:border-dmain rounded-full flex justify-center items-end overflow-hidden">
                <i className="fa-solid fa-user text-[1.5rem] text-gray-200 dark:text-gray-400"></i>
              </div>
            )}
          </div>
          <p className="text-[1rem]">{receiverName}</p>
        </button>
      </section>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex flex-col w-full p-[20px] mb-[100px] overflow-y-auto scrollbar-custom"
      >
        {messages.map((msg, idx) => {
          const prevMsg = messages[idx - 1];
          const isDifferentSender = prevMsg ? prevMsg.isOwn !== msg.isOwn : false;
          const diffDay = !prevMsg || isDifferentDay(prevMsg, msg);

          return (
            <div key={msg._id} className="w-full h-fit flex flex-col">
              {diffDay && (
                <p className="w-full text-center h-fit text-txt2 dark:text-txt2 text-[0.7rem] mt-[20px] mb-[10px]">
                  {formatDDMMYY(msg.createdAt)}
                </p>
              )}

              <div
                className={`w-full h-fit flex items-center gap-2 ${
                  msg.isOwn ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`w-[30px] h-[30px] rounded-full ${
                    isDifferentSender ? "mt-6" : "mt-1"
                  }`}
                >
                  {(isDifferentSender || idx === 0) && !msg.isOwn ? (
                    receiverProfilePic ? (
                      <img
                        src={receiverProfilePic}
                        alt="pfp"
                        className="w-[30px] border-borderColor h-[30px] rounded-full object-cover"
                      />
                    ) : (
                      <div className="aspect-square min-w-[30px] border-[1px] bg-gray-400 dark:bg-[#393939] dark:border-dmain rounded-full flex justify-center items-end overflow-hidden">
                        <i className="fa-solid fa-user text-[1.5rem] text-gray-200 dark:text-gray-400"></i>
                      </div>
                    )
                  ) : null}
                </div>

                <div
                  className={`
                    max-w-[300px] flex flex-col w-fit h-fit p-2 rounded-lg whitespace-pre-wrap break-words
                    ${
                      msg.isOwn
                        ? "bg-gradient-mainBright text-dtxtLight font-medium"
                        : "bg-main dark:bg-dmain self-start text-txt dark:text-dtxt"
                    }
                    ${isDifferentSender ? "mt-6" : "mt-1"}
                  `}
                >
                  {msg.text}

                  <p
                    className={`text-[0.7rem] text-right ${
                      msg.isOwn
                        ? "text-dborderColor font-semibold"
                        : "text-dtxt2 dark:text-txt2 font-medium"
                    }`}
                  >
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {/* ✅ TYPING INDICATOR */}
        {isTyping && (
          <div className="w-full h-fit flex items-center gap-2 justify-start mt-2">
            <div className="w-[30px] h-[30px] rounded-full">
              {receiverProfilePic ? (
                <img
                  src={receiverProfilePic}
                  alt="pfp"
                  className="w-[30px] border-borderColor h-[30px] rounded-full object-cover"
                />
              ) : (
                <div className="aspect-square min-w-[30px] border-[1px] bg-gray-400 dark:bg-[#393939] dark:border-dmain rounded-full flex justify-center items-end overflow-hidden">
                  <i className="fa-solid fa-user text-[1.5rem] text-gray-200 dark:text-gray-400"></i>
                </div>
              )}
            </div>
            <div className="bg-main dark:bg-dmain px-4 py-2 rounded-lg flex items-center gap-1">
              <span className="w-2 h-2 bg-txt2 dark:bg-dtxt2 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-txt2 dark:bg-dtxt2 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-txt2 dark:bg-dtxt2 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="absolute z-[5] bottom-[20px] p-[20px] w-full max-h-[100px] flex justify-center items-center">
        <textarea
          ref={textareaRef}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className="w-full min-h-[35px] cursor-text h-[40px] max-h-[100px] p-[5px] px-[10px] bg-main dark:bg-dmain rounded-xl border border-borderColor dark:border-dborderColor
                     overflow-y-auto scrollbar-hide focus:outline-none whitespace-pre-wrap break-words
                     pr-[50px] text-txt dark:text-dtxt"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          id="sendBtn"
          className="absolute right-[30px] font-bold text-transparent bg-clip-text bg-gradient-main rounded-lg"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatSectionPage;