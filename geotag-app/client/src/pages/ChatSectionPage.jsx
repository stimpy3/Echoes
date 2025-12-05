import { useState,useEffect, useRef } from "react";

const ChatSectionPage= ({ id, name, profilePic }) => {
     
     const [messages, setMessages] = useState([]);
     const textareaRef = useRef();
     const messagesContainerRef = useRef(null); // ref to scroll to

    const handleInput = (e) => {
    const ta = e.target;
    ta.style.height = "40px"; 
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
  };

    // Send message
  const sendMessage = () => {
    const text = textareaRef.current.value.trim();
    if (!text) return;

    setMessages((prev) => [...prev, text]);
    textareaRef.current.value = "";
    textareaRef.current.style.height = "40px"; // reset height
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
  }, [messages])
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
                 <div className="h-fit w-fit mr-[10px]">
                    {profilePic?
                     
                       <img src={profilePic} alt="pfp" className="w-[50px] h-[30px] rounded-full object-cover"/>
     
                      :
                      <div className="aspect-square min-w-[30px] border-[1px] bg-gray-400 dark:bg-[#393939] dark:border-dmain rounded-full flex justify-center items-end overflow-hidden">
                          <i className="fa-solid fa-user text-[2rem] text-gray-200 dark:text-gray-400"></i>
                      </div>
                      }
                 </div>
                 <p className="text-[1.2rem]">{name}</p>
                </section>


                {/*User sending messages */}
                <div ref={messagesContainerRef} className="flex flex-col w-full p-[20px] mb-[100px] overflow-y-auto scrollbar-custom">
                    {messages.map((msg, idx) => (
                      <div key={idx} className="max-w-[300px] w-fit h-fit mb-[3px] p-2 bg-dmain text-white rounded-lg whitespace-pre-wrap  <!-- wrap long text --> 
                               break-words<!-- don't increase width -->">
                        {msg}
                      </div>
                    ))}
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