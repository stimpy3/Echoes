import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Send, User } from "lucide-react";
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
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef();
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const navigate = useNavigate();

  const handleInput = (e) => {
    const ta = e.target;
    ta.style.height = "40px";
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";

    socket.emit("typing", { chatId, receiverId });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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

    socket.emit("stopTyping", { chatId, receiverId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    const tempId = Date.now();
    const optimisticMessage = { _id: tempId, text, isOwn: true, createdAt: new Date() };
    setMessages(prev => [...prev, optimisticMessage]);

    socket.timeout(8000).emit(
      "sendMessage",
      { message: text, chatId, receiverId },
      (err, response) => {
        if (err || !response?.success) {
          setMessages(prev => prev.filter(msg => msg._id !== tempId));
          console.error("Error sending message:", err || response?.error);
          return;
        }
        setMessages(prev =>
          prev.map(msg => (msg._id === tempId ? { ...response.message, isOwn: true } : msg))
        );
        refreshChats();
      }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => {
    setMessages([]);
    setIsTyping(false);
    if (!chatId) return;

    const getMessages = async (chatId) => {
      try {
        const res = await axios.get(`${BASE_URL}/api/messages/${chatId}`, { withCredentials: true });
        setMessages(res.data);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };
    getMessages(chatId);
  }, [chatId]);

  useEffect(() => {
    const handleNewMessage = (msg) => {
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
    return () => socket.off("newMessage", handleNewMessage);
  }, [chatId]);

  useEffect(() => {
    const handleUserTyping = ({ chatId: typingChatId, userId: typingUserId, isTyping: typing }) => {
      if (typingChatId === chatId && typingUserId === receiverId) setIsTyping(typing);
    };
    socket.on("userTyping", handleUserTyping);
    return () => socket.off("userTyping", handleUserTyping);
  }, [chatId, receiverId, receiverName]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const isDifferentDay = (msg1, msg2) => {
    if (!msg1 || !msg2) return true;
    const d1 = new Date(msg1.createdAt);
    const d2 = new Date(msg2.createdAt);
    return d1.getFullYear() !== d2.getFullYear() || d1.getMonth() !== d2.getMonth() || d1.getDate() !== d2.getDate();
  };

  const Avatar = ({ size = 30 }) =>
    receiverProfilePic ? (
      <img src={receiverProfilePic} alt="" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />
    ) : (
      <div style={{ width: size, height: size }} className="rounded-full bg-lightMain2 dark:bg-[#393939] flex items-center justify-center shrink-0">
        <User size={size * 0.5} className="text-gray-400" />
      </div>
    );

  return (
    <div className="relative flex flex-col flex-1 h-screen overflow-hidden bg-main dark:bg-dmain">
      <section className="h-[64px] shrink-0 flex items-center px-5 gap-3 border-b border-hairline dark:border-dhairline">
        <button className="flex items-center gap-3" onClick={() => goToProfile(receiverId)}>
          <Avatar size={34} />
          <div className="flex flex-col items-start">
            <p className="text-[15px] font-semibold text-txt dark:text-dtxt">{receiverName}</p>
            {isTyping && <p className="text-[11.5px]" style={{ color: '#3ed8e3' }}>typing…</p>}
          </div>
        </button>
      </section>

      <div
        ref={messagesContainerRef}
        className="flex-1 flex flex-col w-full px-7 py-6 gap-[10px] overflow-y-auto custom-scrollbar"
      >
        {messages.map((msg, idx) => {
          const prevMsg = messages[idx - 1];
          const isDifferentSender = prevMsg ? prevMsg.isOwn !== msg.isOwn : false;
          const diffDay = !prevMsg || isDifferentDay(prevMsg, msg);

          return (
            <div key={msg._id} className="w-full flex flex-col">
              {diffDay && (
                <p className="w-full text-center text-[11px] font-semibold uppercase tracking-[.12em] text-txt2 dark:text-[#6b6b6b] mt-3 mb-2">
                  {formatDDMMYY(msg.createdAt)}
                </p>
              )}

              <div className={`w-full flex items-end gap-2 ${msg.isOwn ? "justify-end" : "justify-start"} ${isDifferentSender ? "mt-3" : "mt-0.5"}`}>
                {!msg.isOwn && (isDifferentSender || idx === 0) && <Avatar size={30} />}
                {!msg.isOwn && !(isDifferentSender || idx === 0) && <div className="w-[30px] shrink-0" />}

                <div
                  className={`max-w-[300px] flex flex-col w-fit px-[14px] py-[10px] whitespace-pre-wrap break-words text-sm leading-[1.5]
                    ${msg.isOwn
                      ? "bg-gradient-mainBright text-white font-medium rounded-[14px_14px_4px_14px]"
                      : "bg-lightMain dark:bg-[#1f1f1f] text-txt dark:text-[#eee] rounded-[14px_14px_14px_4px]"}`}
                >
                  {msg.text}
                  <p className={`text-[10.5px] text-right mt-1 ${msg.isOwn ? "font-semibold" : "text-txt2 dark:text-[#8a8a8a]"}`} style={msg.isOwn ? { color: 'rgba(255,255,255,.75)' } : undefined}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="w-full flex items-center gap-2 justify-start mt-2">
            <Avatar size={30} />
            <div className="bg-lightMain dark:bg-[#1f1f1f] px-4 py-2 rounded-[14px_14px_14px_4px] flex items-center gap-1">
              <span className="w-[7px] h-[7px] rounded-full bg-txt2 dark:bg-[#8a8a8a] animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-[7px] h-[7px] rounded-full bg-txt2 dark:bg-[#6b6b6b] animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-[7px] h-[7px] rounded-full bg-txt2 dark:bg-[#4d4d4d] animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="h-20 shrink-0 flex items-center gap-3 px-6 border-t border-hairline dark:border-dhairline">
        <textarea
          ref={textareaRef}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          className="flex-1 min-h-[40px] h-[40px] max-h-[100px] px-4 py-[9px] rounded-full bg-slightLightMain dark:bg-[#1c1c1c] text-txt dark:text-dtxt
                     border-none overflow-y-auto scrollbar-hide focus:outline-none focus-visible:ring-2 focus-visible:ring-accentMain whitespace-pre-wrap break-words text-sm"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          aria-label="Send"
          className="w-11 h-11 rounded-full bg-gradient-mainBright flex items-center justify-center shrink-0 focus-visible:ring-2 focus-visible:ring-accentMain"
        >
          <Send size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
};

export default ChatSectionPage;
