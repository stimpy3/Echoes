import { useState,useEffect } from 'react';
import MemoryCard from '../components/Memories/MemoryCard';
import AddMemoryForm from '../components/Memories/AddMemoryForm';

import Navbar from '../components/Layout/Navbar';
import SplitText from "../components/Layout/SplitText";
import { useTheme } from "../context/ThemeContext";
import animationData from "../data/animationData/emptyAnimation.json";
import Lottie from "lottie-react";
import axios from "axios";
import { ChevronLeft,ChevronRight,UserPlus } from 'lucide-react';

const MemoriesPage = () => {
  const { dark, setDark } = useTheme();
  const [memories, setMemories] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
     const [name,setName]=useState("");
   const [email,setEmail]=useState("");
   const [address,setAddress]=useState("");
   const [profilePic,setProfilePic]=useState("");
  const [addrLoading, setAddrLoading] = useState(false);

    const BASE_URL=import.meta.env.VITE_BASE_URL || "http://localhost:5000";
   //run when component mounts
   useEffect(()=>{
    const fetchUser = async () => {
    
      try{
        const res=await axios.get(`${BASE_URL}/api/user/navbar`,{ withCredentials: true });
        setName(res.data.name);
        setEmail(res.data.email);
        setProfilePic(res.data.profilePic);
      }
      catch(err){
        console.error("Error fetching user data:", err.response?.data || err.message);
        setName("");
        setEmail("");
        setProfilePic("");
      }
    };
    
    fetchUser();     
   },[]);
   

   

  
 

  const handleDeleteMemory = async (id) => {
    if (window.confirm('Are you sure you want to delete this memory?')) {
      setMemories(memories.filter((m) => m._id !== id));
      try {
       await axios.delete(`${BASE_URL}/api/memory/deletememory/${id}`,{withCredentials:true});
      }
      catch(err){
        console.error("Failed to delete memory:",err);
      }
    }
  };


  const handleEditMemory = async (updatedMemory) => { 
  try {
    //PATCH request to backend
    const res = await axios.patch(
      `${BASE_URL}/api/memory/editmemory/${updatedMemory._id}`,
      { title: updatedMemory.title, description: updatedMemory.description },
      { withCredentials: true }
    );

  
    setMemories(memories.map((m) =>
      m._id === updatedMemory._id ? res.data.memory : m
    ));
  } catch (err) {
    console.error("Failed to edit memory:", err);
  }
};
  

   useEffect(()=>{
   const fetchMemories=async()=>{
    try{
        const res= await axios.get(`${BASE_URL}/api/memory/fetchmemory`, {withCredentials: true });// credentials:true is crucial for sending cookies
        setMemories([...memories, ...(res.data.memories || [])]);
    }
    catch(err){
      console.error("Failed to fetch memories:",err);
    }
   }
   fetchMemories();
  },[]);


  useEffect(() => {
  const container = document.getElementById("suggestionContainer");
  const leftBtn = document.getElementById("scrollLeft");
  const rightBtn = document.getElementById("scrollRight");

  const updateButtonVisibility = () => {
    if (!container) return;
    const isOverflowing = container.scrollWidth > container.clientWidth;
    const canScrollLeft = container.scrollLeft > 0;
    const canScrollRight =
      container.scrollLeft < container.scrollWidth - container.clientWidth - 5;

    leftBtn.style.opacity = isOverflowing && canScrollLeft ? "1" : "0";
    leftBtn.style.pointerEvents = isOverflowing && canScrollLeft ? "auto" : "none";
    rightBtn.style.opacity = isOverflowing && canScrollRight ? "1" : "0";
    rightBtn.style.pointerEvents = isOverflowing && canScrollRight ? "auto" : "none";
  };

  // Attach listeners
  container.addEventListener("scroll", updateButtonVisibility);
  window.addEventListener("resize", updateButtonVisibility);

  updateButtonVisibility(); // initial check

  return () => {
    container.removeEventListener("scroll", updateButtonVisibility);
    window.removeEventListener("resize", updateButtonVisibility);
  };
}, []);


  const [requestedList, setRequestedList] = useState(Array(10).fill(false));

  const handleRequest = (index) => {
  const updated = [...requestedList];
  updated[index] = !updated[index];
  setRequestedList(updated);
};

  return (
    <div className="bg-main dark:bg-dmain w-full min-h-screen flex flex-col px-[30px] pb-[10px]">
      <Navbar />
      <div className="mt-[70px] flex flex-col justify-center items-center bg-main dark:bg-dmain  pb-[5px]">
        <div className="w-full overflow-hidden pb-[50px]">
                        {/* Cover image */}
                       
                      
                        {/* Profile section */}
                        <div className="h-[200px] flex items-center">
                          {/* Profile picture and buttons */}
                          <div className="min-w-36 flex items-center justify-between">
                            { profilePic? 
                              <img src={profilePic} alt="pfp" referrerPolicy="no-referrer" className="w-36 h-36 z-[10] border-[5px] border-main dark:border-dmain  rounded-full object-cover"/>
                            :       
                            <div className="z-[10] absoulte w-36 h-36 rounded-full border-4 border-main dark:border-dmain overflow-hidden bg-gray-300 flex items-center justify-center">
                              <i className="fa-solid fa-user text-5xl text-gray-500"></i>
                            </div>
                            }
                            
                            
                          </div>
                      
                          {/* Name and info */}
                          <div className="px-[30px] w-full flex flex-col">
                            <div className="w-full pb-[30px]">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{`${name.length>20?name.slice(0,19)+"...":name}`}</h2>
                            <p className="text-txt2 dark:text-dtxt2 text-sm mb-1">{`${email.length>40?email.slice(0,49)+"...":email}`}</p>
                            <p className="text-gray-500 dark:text-gray-500 text-sm">{address}</p>
                            </div>
                            <div className="w-full flex justify-around text-[1.5rem]" >
                              <p>{memories.length}&nbsp;<span className='text-txt2 dark:text-dtxt2'>echoes</span></p>
                              <p>{0}&nbsp;<span className='text-txt2 dark:text-dtxt2'>followers</span></p>
                              <p>{0}&nbsp;<span className='text-txt2 dark:text-dtxt2'>following</span></p>
                            </div>
                          </div>
                      
                                          
                        </div>
                      </div>
        {/* Header */}
        

        {/* Memories Grid */}
        {memories.length === 0 ? (
          <div className="pb-[10px] flex flex-col items-center  text-center w-full h-[100%]  rounded-lg">
            <Lottie animationData={animationData} loop={true} className="h-[250px] aspect-square overflow-hidden"/>
            <p className="text-txt dark:text-dtxt text-lg mb-4">No memories yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {memories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onDelete={handleDeleteMemory}
                onEdit={handleEditMemory}
              />
            ))}
          </div>
        )}

        <section className="w-full h-[300px] mt-[50px] flex flex-col relative">
  <p className="text-[1.5rem] h-[50px] flex items-center">Suggested for you</p>

  {/* Scroll container */}
  <div
    data-label="suggestionContainer"
    className="w-full h-[270px] flex overflow-x-auto scroll-smooth relative scrollbar-hide"
    id="suggestionContainer"
  >
    {Array.from({ length: 10 }).map((_, i) => (
      <div key={i} data-label="suggestion" className="h-[250px] py-[20px] mx-[15px]">
        <div className="h-full bg-lightMain dark:bg-dlightMain rounded-[10px] w-[150px] overflow-hidden">
          <div className="w-full p-[10px] h-[75%] flex flex-col items-center justify-center">
            <div className="w-[90px] h-[90px] rounded-full bg-dlightMain2 flex items-end justify-center overflow-hidden">
              <i className="fa-solid fa-user text-7xl text-gray-300"></i>
            </div>
            <div className="py-[5px]">Username {i + 1}</div>
          </div>
          <div className="w-full h-[25%] p-[10px] flex items-center justify-center">
            <button
                onClick={() => handleRequest(i)}
                className={`rounded-[5px] w-full p-[5px] flex justify-center text-white transition-colors duration-300 ${
                  requestedList[i] ? "bg-dgradient-main" : "bg-gradient-main"
                }`}
              >
                {requestedList[i] ? "Requested" : <div className="h-fit w-fit flex justify-center"><UserPlus/>&nbsp;Follow</div> }
              </button>
          </div>
        </div>
      </div>
    ))}
  </div>

  {/* Left Button */}
  <button
    id="scrollLeft"
    onClick={() => {
      const container = document.getElementById("suggestionContainer");
      container.scrollBy({ left: -300, behavior: "smooth" });
    }}
    className="absolute left-0 top-1/2 -translate-y-1/2 bg-dlightMain2 border-borderColor border-[1.5px] text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:scale-105 transition-transform opacity-0 pointer-events-none"
  >
    <ChevronLeft/>
  </button>

  {/* Right Button */}
  <button
    id="scrollRight"
    onClick={() => {
      const container = document.getElementById("suggestionContainer");
      container.scrollBy({ left: 300, behavior: "smooth" });
    }}
    className="absolute right-0 top-1/2 -translate-y-1/2 bg-dlightMain2 border-borderColor border-[1.5px]  text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:scale-105 transition-transform opacity-0 pointer-events-none"
  >
    <ChevronRight/>
  </button>
</section>


      </div>
    </div>
  );
};

export default MemoriesPage;
