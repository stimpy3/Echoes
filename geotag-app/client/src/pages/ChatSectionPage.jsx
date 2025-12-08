import { useState,useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { formatTime } from "../utils/formatTime";
import axios from "axios";


const ChatSectionPage= ({ refreshChats, chatId ,receiverId, receiverName, receiverProfilePic }) => {
     const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

     const [messages, setMessages] = useState([]);
     const textareaRef = useRef();
     const messagesContainerRef = useRef(null); // ref to scroll to
     const navigate = useNavigate();

    const handleInput = (e) => {
    const ta = e.target;
    ta.style.height = "40px"; 
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
  };

   //redirect to profile page
    const goToProfile = (userId) => navigate(`/profile/${userId}`);



  // Send message
  const sendMessage = async () => {
         const text = textareaRef.current.value.trim();
         if (!text) return;
       
         textareaRef.current.value = "";
         textareaRef.current.style.height = "40px";


          const optimisticMessage = {
            _id: Date.now(), // temporary ID
            text,
            isOwn: true,
            createdAt: new Date(),
          };
          setMessages(prev => [...prev, optimisticMessage]);
 
         // Send to backend
         try {
           await axios.post(`${BASE_URL}/api/messages/sendmessage`, {
             receiver: receiverId,
             text
           }, { withCredentials: true });
           refreshChats();
         } catch (err) {
           console.error("Error sending message:", err);
           //Rollback: remove optimistic message if request fails
           setMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
         }
    };


  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // prevent newline
      sendMessage();
    }
  };

   useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight; // instantly scroll
    }
  }, [messages]);


  useEffect(() => {
       setMessages([]);
       if (!chatId) return;
       const getMessages = async (chatId) => {
          try{
          const res = await axios.get(`${BASE_URL}/api/messages/${chatId}`, { withCredentials: true });
          setMessages(res.data);
          }
           catch(err){ 
             console.error("Error fetching messages:", err);
           }
      
      }
      getMessages(chatId);
    },[chatId]);
    /*
    {profilePic?
                
                  <img src={profilePic} alt="pfp" className="w-[50px] h-[50px] rounded-full object-cover"/>

                 :
                 <div className="aspect-square min-w-[50px] border-[1px] bg-gray-400 dark:bg-[#393939] dark:border-dmain rounded-full flex justify-center items-end overflow-hidden">
                     <i className="fa-solid fa-user text-[2rem] text-gray-200 dark:text-gray-400"></i>
                 </div>
                 }
     */
    return(
         <div className="relative flex flex-col w-full h-screen overflow-hidden bg-lightMain dark:bg-dfadeColor  ">
               <section className="w-full bg-main dark:bg-dmain h-[50px] p-[10px] flex items-center">
                 <button  className="h-fit w-fit flex" onClick={() => goToProfile(receiverId)}>
                 <div className="h-fit w-fit mr-[10px]">
                    {receiverProfilePic?
                     
                       <img src={receiverProfilePic} alt="pfp" className="w-[30px] border-borderColor h-[30px] rounded-full object-cover"/>
     
                      :
                      <div className="aspect-square min-w-[30px] border-[1px] bg-gray-400 dark:bg-[#393939] dark:border-dmain rounded-full flex justify-center items-end overflow-hidden">
                          <i className="fa-solid fa-user text-[1.5rem] text-gray-200 dark:text-gray-400"></i>
                      </div>
                      }
                 </div>
                 <p className="text-[1rem]">{receiverName}</p>
                 </button>
                </section>


                {/*User sending messages */}
               
               <div ref={messagesContainerRef} className="flex flex-col  w-full p-[20px] mb-[100px] overflow-y-auto scrollbar-custom">
                    {messages.map((msg, idx) => {
                      const prevMsg = messages[idx - 1];
                      const isDifferentSender = prevMsg ? prevMsg.isOwn !== msg.isOwn : false;
                      return (
                        <div key={idx} className={`w-full h-fit flex items-center gap-2 ${
                           msg.isOwn ? "justify-end" : "justify-start"}`}>
                          
                            {/* Sender Dot */}
                            <div
                              className={`w-[30px] h-[30px] rounded-full ${
                                isDifferentSender
                                  ? "mt-6"
                                  : "mt-1"
                              }`}
                            >
                               {isDifferentSender || idx==0 ? (!msg.isOwn? (receiverProfilePic?        
                                       <img src={receiverProfilePic} alt="pfp" className="w-[30px] border-borderColor h-[30px] rounded-full object-cover"/>
                                      :
                                      <div className="aspect-square min-w-[30px] border-[1px] bg-gray-400 dark:bg-[#393939] dark:border-dmain rounded-full flex justify-center items-end overflow-hidden">
                                          <i className="fa-solid fa-user text-[1.5rem] text-gray-200 dark:text-gray-400"></i>
                                      </div>)
                                      :
                                      "")
                                      :
                                      ""
                               }
                            </div>
                          
                            {/* Message Bubble */}
                            <div
                              className={`
                                max-w-[300px] flex flex-col w-fit h-fit p-2 rounded-lg whitespace-pre-wrap break-words
                                ${msg.isOwn
                                  ? "bg-gradient-mainBright text-dtxtLight font-medium "
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
                      );
                    })}
               </div>
                  
                    

            

               <div className="absolute z-[5] bottom-[20px] p-[20px]  w-full max-h-[100px] flex justify-center items-center">
                      <textarea ref={textareaRef} onInput={handleInput} onKeyDown={handleKeyDown}
                        className="w-full min-h-[35px] cursor-text h-[40px] max-h-[100px]  p-[5px] px-[10px] bg-main dark:bg-dmain  rounded-xl border border-borderColor dark:border-dborderColor
                               overflow-y-auto scrollbar-hide focus:outline-none whitespace-pre-wrap  <!-- wrap long text --> 
                               break-words<!-- don't increase width -->
                               pr-[50px]  text-txt dark:text-dtxt
                      "
                      placeholder="Type a message..."
                      >
                       
                      </textarea>
                       <button onClick={sendMessage} id="sendBtn" className="absolute right-[30px] font-bold text-transparent bg-clip-text bg-gradient-main rounded-lg">
                         Send
                       </button>
                </div>
         </div>
    );
};

export default ChatSectionPage;