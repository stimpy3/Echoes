import { ChevronLeft,Search,MessageSquareDot } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState,useEffect, use } from "react";
import ChatSectionPage from "./ChatSectionPage"; 
import axios from "axios";

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

const ChatPage= () => {
const flag= true; //toggle this to show chat section or not
const [userList,setUserList]= useState([]);
const [openChat,setOpenChat]= useState(false);
const [currentChatUser,setCurrentChatUser]= useState({});
 const navigate = useNavigate();

 useEffect(() => {
    // Fetch the list of users the current user is following  
    const fetchUserList = async () => {
      try {
         const res = await axios.get(`${BASE_URL}/api/users/following`, {
          withCredentials: true,
        });
         setUserList(res.data || []);
      }
      catch (err) {
        console.error("Error fetching user list:", err);
      }
 }
  fetchUserList();
},
 [])

 const handleOpenchat= (id,name,profile) => {
   setOpenChat(true);
   setCurrentChatUser({id,name,profile});
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
  {userList.length === 0 ? (
    <p>follow people to chat</p>
  ) : (
    userList.map((user) => (
      <div 
        onClick={()=>{handleOpenchat(user._id, user.name, user.profilePic)}}
        key={user._id} 
        className="w-full h-[60px] flex items-center gap-4 p-3 bg-lightMain dark:bg-dlightMain border-y-[1px] border-borderColor dark:border-dborderColor cursor-pointer"
      >
        <div className="h-fit w-fit">
          {user.profilePic?
                
                  <img src={user.profilePic} alt="pfp" className="w-[30px] h-[30px] rounded-full object-cover"/>

                 :
                 <div className="aspect-square min-w-[30px] border-[1px] bg-gray-400 dark:bg-[#393939] dark:border-dborderColor rounded-full flex justify-center items-end overflow-hidden">
                     <i className="fa-solid fa-user text-[2rem] text-gray-200 dark:text-gray-400"></i>
                 </div>
                 }
        </div>
        <div>{user.name}</div>
      </div>
    ))
  )}
</section>

        </section>

        {/* right panel - real chat */}
        {openChat? <ChatSectionPage id={currentChatUser.id} name={currentChatUser.name} profilePic={currentChatUser.profilePic} /> :
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