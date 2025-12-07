import { ChevronLeft,Search,MessageSquareDot } from "lucide-react";
import { useNavigate,useLocation } from "react-router-dom";
import { useState,useEffect, use } from "react";
import { formatTime } from "../utils/formatTime";
import ChatSectionPage from "./ChatSectionPage"; 
import axios from "axios";

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

const ChatPage= () => {
const [openChat,setOpenChat]= useState(false);
const [currentChatUser,setCurrentChatUser]= useState({});
const [selectedUserId, setSelectedUserId] = useState(null);
const [myId, setMyId] = useState(null);
const [chatList, setChatList] = useState([]);
const [followingList, setFollowingList] = useState([]);
const [finalList, setFinalList] = useState([]); // merged and sorted list
const [unreadCount, setUnreadCount] = useState(0);
const [lastMessage, setLastMessage] = useState("");
const [chatId, setChatId] = useState(null);

 const navigate = useNavigate();
 const location = useLocation();

//fetch logged-in user to get myId
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
  try {
    try {
        // 1 Fetch all existing chats
        const chatRes = await axios.get(`${BASE_URL}/api/chats/mychats`, {
          withCredentials: true
        });
        const chats = chatRes.data || [];
        setChatList(chats);

        // 2 Fetch all users you follow
        const followRes = await axios.get(`${BASE_URL}/api/users/following`, {
          withCredentials: true
        });
        const following = followRes.data || [];
        setFollowingList(following);

        // 3 Merge chats + following users (excluding users already in chat)
        const mergedList = [
          // Existing chats
          ...chats.map(chat => {
            const other = chat.participants.find(p => p._id !== myId);
            return {
              id: other._id,
              name: other.name,
              profilePic: other.profilePic,
              lastMessage: chat.lastMessage,
              unreadCount: chat.unreadCount[myId] || 0,
              isChat: true,
              chatId: chat._id, 
              updatedAt: chat.updatedAt
            };
          }),
          // Following users without a chat
          ...following
            .filter(user => !chats.some(chat => chat.participants.some(p => p._id === user._id)))
            .map(user => ({
              id: user._id,
              name: user.name,
              profilePic: user.profilePic,
              lastMessage: "",
              unreadCount: 0,
              isChat: false,
              chatId: null,
              updatedAt: 0
            }))
        ];

        // 44 Sort merged list by updatedAt descending
        mergedList.sort((a, b) => b.updatedAt - a.updatedAt);

        setFinalList(mergedList);

      } catch (err) {
        console.error("Error fetching chats or following users:", err);
      }

  } catch (err) {
    console.error("Error refreshing chats:", err);
  }
};

useEffect(() => {
  if (!myId) return;
  refreshChats();
}, [myId]);


 // Check if user came from a "Message" button with state
  useEffect(() => {
    if (location.state) {
      const { id, name, profilePic } = location.state;
      setCurrentChatUser({ id, name, profilePic });
      setOpenChat(true);
      navigate("/chat", { replace: true }); // optional: clears location.state
    }
  }, [location.state]);

 const handleOpenChat= async (chatId,id,name,profilePic) => {
       setOpenChat(true);
       setCurrentChatUser({id,name,profilePic});
       setChatId(chatId);
       setSelectedUserId(id); // mark as selected
      //Reset unread count on backend
      
      try {
        await axios.post(`${BASE_URL}/api/chats/mark-read/${id}`, {}, {
          withCredentials: true,
        });
      } catch (err) {
        console.error("Error marking read:", err);
      }
      //Refresh UI chat list
      refreshChats();
 };

  return(
    <div className="flex w-full h-screen overflow-hidden bg-black">
       {/* left panel */}
        <section className="min-w-[300px] w-[400px] bg-lightMain dark:bg-dfadeColor h-full border-r-[1px] border-borderColor dark:border-dborderColor flex flex-col">

            <div className="w-full h-fit py-[10px] bg-main  dark:bg-dmain flex flex-col">
                
                <div className="w-full h-[35px] flex relative">
                     <div className="absolute top-1/2 -translate-y-[50%] -translate w-fit flex items-center cursor-pointer" onClick={() => navigate(-1)} >
                        <ChevronLeft className="text-txt2 dark:text-dtxt" size={28} />         
                      </div>
     
                      <div className="w-full h-full mb-[10px] flex justify-center items-center font-semibold text-[1.3rem]
                      text-transparent bg-clip-text bg-gradient-main">
                        <h1 className="text-transparent bg-clip-text bg-gradient-main ">Messages</h1>
                      </div>
                 </div>


                 <div>
                   {/* search bar */}
                   <div className="flex w-full h-[45px] rounded-[10px] items-center px-[10px]">
                     
                         <div className="rounded-[10px] relative w-full h-4/5 ">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt2 dark:text-dtxt2" size={18} />        
                              <input type="text" placeholder="Search"className="w-full h-full pl-10 rounded-[10px] bg-lightMain dark:bg-dfadeColor"/>
                         </div>

                   </div>

                 </div>



            </div>{/*chat search and header section end */}

            <section className="w-full h-full">
                         {finalList.length === 0 ? (
                           <p></p>
                         ) : (
                           finalList.map((user) => (
                                  <div
                                    onClick={() => handleOpenChat(user.chatId,user.id, user.name, user.profilePic)}
                                    key={user.id}
                                    className={`w-full h-[60px] flex flex-row items-center gap-4 p-3 
                                      cursor-pointer 
                                      ${selectedUserId === user.id ? " border-y-[1px]  bg-main dark:bg-dlightMain" : ""}`}
                                  >
                                    <div className="h-fit w-fit">
                                      {user.profilePic ? (
                                        <img
                                          src={user.profilePic}
                                          alt="pfp"
                                          className="w-[30px] h-[30px] rounded-full object-cover"
                                        />
                                      ) : (
                                        <div className="aspect-square min-w-[30px] border-[1px] bg-gray-400 dark:bg-[#393939] dark:border-dborderColor rounded-full flex justify-center items-end overflow-hidden">
                                          <i className="fa-solid fa-user text-[1.5rem] text-gray-200 dark:text-gray-400"></i>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col flex-1">
                                      <p>{user.name}</p>
                                      <p className="text-[0.9rem] text-txt2 dark:text-dtxt2">
                                        {  user.lastMessage? 
                                           user.lastMessage.length > 20? 
                                           user.lastMessage.slice(0, 20) + "…"
                                           : user.lastMessage
                                           : "No messages yet"
                                        }
                                      </p>
                                    </div>
                                    <div className="flex flex-col justify-between items-end">
                                      {user.unreadCount > 0 && (
                                        <div className="w-[20px] h-fit aspect-square text-[0.9rem] font-bold bg-gradient-main text-dtxt dark:text-txt rounded-full flex justify-center items-center">
                                          {user.unreadCount}
                                        </div>
                                      )}
                                      <p className="text-[0.8rem] text-txt2 dark:text-dtxt2 self-end"> {formatTime(user.updatedAt)}</p>
                                    </div>
                                  </div>
                                ))
                       
                         )}
            </section>

            </section>
    
            {/* right panel - real chat */}
            {openChat? <ChatSectionPage refreshChats={refreshChats} chatId={chatId} receiverId={currentChatUser.id} receiverName={currentChatUser.name} receiverProfilePic={currentChatUser.profilePic} /> :
             <section  className="w-full bg-main dark:bg-dmain h-full flex flex-col items-center justify-center ">
               <div className="h-[200px] bg-[url('/lightLogo.png')] dark:bg-[url('/grayLogo.png')] bg-contain bg-no-repeat aspect-[445/549]">
               </div>
               <p  className="text-[#dedede] dark:text-dborderColor font-bold">Your chats appear here</p>
            </section>
            }
       
    </div>
  );
};

export default ChatPage;