import { Search } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { formatTime } from "../utils/formatTime";
import { socket } from "../utils/socket";
import Rail from "../components/Layout/Rail";
import ChatSectionPage from "./ChatSectionPage";
import BareBonesChatPage from "./BarebonesPages/BareBonesChatPage";
import msgPlane from "../data/animationData/msgPlane.json";
import Lottie from "lottie-react";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

const ChatPage = () => {
  const [openChat, setOpenChat] = useState(false);
  const [currentChatUser, setCurrentChatUser] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [myId, setMyId] = useState(null);
  const [chatList, setChatList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [finalList, setFinalList] = useState([]);
  const [search, setSearch] = useState("");
  const [chatId, setChatId] = useState(null);
  const [loading, setLoading] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/user/navbar`, { withCredentials: true });
        setMyId(res.data._id);
      } catch (err) {
        console.error("Error fetching logged-in user:", err);
      }
    };
    fetchMe();
  }, []);

  const refreshChats = async () => {
    setLoading(true);
    try {
      const chatRes = await axios.get(`${BASE_URL}/api/chats/mychats`, { withCredentials: true });
      const chats = chatRes.data || [];
      setLoading(false);
      setChatList(chats);

      const followRes = await axios.get(`${BASE_URL}/api/users/following`, { withCredentials: true });
      const following = followRes.data || [];
      setFollowingList(following);

      const mergedList = [
        ...chats.map((chat) => {
          const other = chat.participants.find((p) => p._id !== myId);
          return {
            id: other._id,
            name: other.name,
            profilePic: other.profilePic,
            lastMessage: chat.lastMessage,
            unreadCount: chat.unreadCount[myId] || 0,
            isChat: true,
            chatId: chat._id,
            updatedAt: chat.updatedAt,
          };
        }),
        ...following
          .filter((u) => !chats.some((chat) => chat.participants.some((p) => p._id === u._id)))
          .map((u) => ({
            id: u._id,
            name: u.name,
            profilePic: u.profilePic,
            lastMessage: "",
            unreadCount: 0,
            isChat: false,
            chatId: null,
            updatedAt: 0,
          })),
      ];

      mergedList.sort((a, b) => b.updatedAt - a.updatedAt);
      setFinalList(mergedList);
    } catch (err) {
      console.error("Error refreshing chats:", err);
    }
  };

  useEffect(() => {
    if (!myId) return;
    if (!socket.connected) socket.connect();
    refreshChats();
  }, [myId]);

  useEffect(() => {
    const run = async () => {
      if (!location.state) return;
      const { id, name, profilePic } = location.state;
      setCurrentChatUser({ id, name, profilePic });
      try {
        const res = await axios.post(`${BASE_URL}/api/chats/mark-read/${id}`, {}, { withCredentials: true });
        setChatId(res.data.chatId);
        setOpenChat(true);
      } catch (err) {
        console.error("Error marking read:", err);
      }
    };
    run();
  }, [location.state]);

  const handleOpenChat = async (chatId, id, name, profilePic) => {
    setOpenChat(true);
    setCurrentChatUser({ id, name, profilePic });
    setChatId(chatId);
    setSelectedUserId(id);

    try {
      await axios.post(`${BASE_URL}/api/chats/mark-read/${id}`, {}, { withCredentials: true });
    } catch (err) {
      console.error("Error marking read:", err);
    }
    refreshChats();
  };

  const visibleList = search
    ? finalList.filter((u) => u.name?.toLowerCase().includes(search.toLowerCase()))
    : finalList;

  return (
    <div className="flex w-full h-screen overflow-hidden bg-main dark:bg-dmain">
      <Rail />

      {loading ? (
        <BareBonesChatPage />
      ) : (
        <section className="w-[320px] shrink-0 bg-main dark:bg-[#0e0e0e] h-full border-r border-hairline dark:border-dhairline flex flex-col">
          <div className="h-[112px] p-5 flex flex-col gap-3 shrink-0">
            <h1 className="text-[22px] font-bold text-txt dark:text-dtxt">Messages</h1>
            <div className="relative">
              <Search size={16} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-txt2 dark:text-[#8a8a8a]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full pl-[38px] pr-3 py-[9px] rounded-full text-sm bg-slightLightMain dark:bg-[#1c1c1c] text-txt dark:text-dtxt placeholder:text-txt2 dark:placeholder:text-[#8a8a8a] outline-none focus-visible:ring-2 focus-visible:ring-accentMain"
              />
            </div>
          </div>

          <section className="flex-1 overflow-y-auto custom-scrollbar">
            {visibleList.map((user) => {
              const selected = selectedUserId === user.id;
              const unread = user.unreadCount > 0;
              return (
                <div
                  onClick={() => handleOpenChat(user.chatId, user.id, user.name, user.profilePic)}
                  key={user.id}
                  className={`h-[72px] flex items-center gap-3 px-5 cursor-pointer relative border-b border-hairline dark:border-[#1c1c1c]
                    ${selected ? "bg-lightMain dark:bg-[#1a1a1a]" : ""}`}
                >
                  {selected && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-main" />}

                  {user.profilePic ? (
                    <img src={user.profilePic} alt="" className="w-[38px] h-[38px] rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-[38px] h-[38px] rounded-full bg-lightMain2 dark:bg-[#393939] flex items-center justify-center shrink-0">
                      <span className="text-gray-400 text-xs">{user.name?.[0]}</span>
                    </div>
                  )}

                  <div className="flex flex-col flex-1 min-w-0">
                    <p className={`text-sm truncate ${unread ? 'font-semibold text-txt dark:text-dtxt' : 'font-medium text-lightTxt dark:text-[#d0d0d0]'}`}>{user.name}</p>
                    <p className="text-[12.5px] text-txt2 dark:text-[#8a8a8a] truncate">
                      {user.lastMessage || "No messages yet"}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-[11px] text-txt2 dark:text-[#8a8a8a]">{formatTime(user.updatedAt)}</p>
                    {unread && (
                      <div className="min-w-[18px] h-[18px] px-1 text-[11px] font-bold bg-gradient-main text-black rounded-full flex justify-center items-center">
                        {user.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </section>
      )}

      {openChat ? (
        <ChatSectionPage
          refreshChats={refreshChats}
          chatId={chatId}
          receiverId={currentChatUser.id}
          receiverName={currentChatUser.name}
          receiverProfilePic={currentChatUser.profilePic}
          myId={myId}
        />
      ) : (
        <section className="flex-1 bg-[url('/doodleBackgroundWhite.png')] dark:bg-[url('/doodleBackgroundDark.png')] h-full flex flex-col items-center justify-center">
          <Lottie animationData={msgPlane} loop className="h-[300px]" />
          <p className="text-txt2 dark:text-dtxt2 text-xl font-light">Your chats appear here</p>
        </section>
      )}
    </div>
  );
};

export default ChatPage;
