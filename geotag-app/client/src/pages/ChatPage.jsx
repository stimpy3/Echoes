import { ChevronLeft,Search,MessageSquareDot } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ChatPage= () => {
 const navigate = useNavigate();
  return(
    <div className="flex w-full h-screen overflow-hidden bg-black">
        <section className="min-w-[300px] w-[400px] bg-lightMain dark:bg-dlightMain h-full border-r-[1px] border-borderColor dark:border-dborderColor flex flex-col">

            <div className="w-full h-[80px] bg-main border-b-[1px] border-borderColor dark:border-dborderColor dark:bg-dmain flex flex-col">
                
                <div className="w-full h-[35px] flex relative">
                     <div className="absolute top-1/2 -translate-y-[50%] -translate w-fit flex items-center cursor-pointer" onClick={() => navigate(-1)} >
                        <ChevronLeft className="text-txt2 dark:text-dtxt" size={28} />         
                      </div>
     
                      <div className="w-full h-full flex justify-center items-center font-semibold text-[1.3rem]
                      text-transparent bg-clip-text bg-gradient-main">
                        <h1>Messages</h1></div>
                 </div>


                 <div>
                   {/* search bar */}
                   <div className="flex w-full h-[45px] items-center p-[5px] px-[10px]">
                     
                         <div className=" rounded-md relative w-full border-[1px] border-borderColor dark:border-dborderColor">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt2 dark:text-dtxt2" size={18} />        
                              <input type="text" placeholder="Search"className="w-full pl-10 border rounded-md bg-lightMain dark:bg-dlightMain"/>
                         </div>

                   </div>

                 </div>



            </div>{/*chat search and header section end */}

            <section className="w-full h-full">
                {/* chat list */}
            </section>

        </section>
        <section  className="w-full bg-main dark:bg-dmain h-full flex flex-col items-center justify-center ">
           <div className="h-[200px] bg-[url('/lightLogo.png')] dark:bg-[url('/grayLogo.png')] bg-contain bg-no-repeat aspect-[445/549]">
           </div>
           <p  className="text-[#dedede] dark:text-dborderColor font-bold">Your chats appear here</p>
        </section>
    </div>
  );
};

export default ChatPage;