import { Locate,Layers2,X } from "lucide-react";
import React, { useState,useEffect } from "react";
import MapView from "../components/Map/MapView";

import Navbar from "../components/Layout/Navbar";
import GradientText from "../components/Layout/GradientText";
import { useTheme } from "../context/ThemeContext";
import { useHome } from "../context/HomeContext";
import AddMemoryForm from "../components/Memories/AddMemoryForm";
import { shortenText } from "../utils/textShorten";
import { useNavigate } from 'react-router-dom';

import axios from "axios";

const HomePage = () => {
  const BASE_URL=import.meta.env.VITE_BASE_URL || "http://localhost:5000";
  const { dark } = useTheme();
  const { homePosition, loading } = useHome();
    const navigate = useNavigate();
  const [addingMode, setAddingMode] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [followList, setFollowList] = useState(false);
  const [memories, setMemories] = useState([]);
  const [friendMemories,setFriendMemories] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activePinPeople, setActivePinPeople] = useState([]);
  const [applyLoading, setApplyLoading] = useState(false);

  const handleMapClick = (latlng) => {
    if (!addingMode) return;
    setSelectedPosition(latlng);
    setShowForm(true);
    setAddingMode(false);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedPosition(null);
  };

const toggleFollowingList = () => {
  setFollowList(prev => !prev);
};

const fetchFollowing = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/api/users/following`, {
      withCredentials: true,
    });
    setFollowing(res.data || []);
  } catch (err) {
    console.error("Error fetching following list:", err);
  }
};



 const applyFilter = async () => {
  setApplyLoading(true);
  try {
    const res = await axios.post(
      `${BASE_URL}/api/memory/friendMemory`,
      { userIds: activePinPeople },
      { withCredentials: true }
    );

    setFriendMemories(res.data);

  } catch (err) {
    console.error("Error applying filter:", err);
  }
  setApplyLoading(false);
  toggleFollowingList();
};



  //Resets map view to current home position
  const resetToAutoLocation = () => {
    if (!homePosition) return alert("Home location not available.");
    // You could also trigger map pan programmatically if you store the map ref in context
    alert("Reset to your current home location!");
  };

  
  //fetch memories on mount
  useEffect(()=>{
   const fetchMemories=async()=>{
    try{
        const res= await axios.get(`${BASE_URL}/api/memory/fetchmemory`, {withCredentials: true // crucial for sending cookies
   });
        setMemories([...memories, ...(res.data.memories || [])]);
    }
    catch(err){
      console.error("Failed to fetch memories:",err);
    }
   }
   fetchMemories();
  },[]);

  return (
    <div className="w-[100vw] h-[100vh] bg-main dark:bg-dmain relative">
      <div className="h-full w-full relative overflow-hidden">
        {/* 🔹 Hide Navbar in add mode */}
        {!addingMode && <Navbar />}

        {/* 🔹 Add mode info bar */}
        {addingMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] px-4 py-2 rounded-full bg-dmain/80 dark:bg-main/80 text-dtxt dark:text-txt font-medium shadow-md text-sm backdrop-blur-sm">
            Add Memory Mode - Click on the map to add a memory
          </div>
        )}

        {/* 🔹 Map */}
        {!loading && (
          <MapView
            friendMemories={friendMemories}
            memories={memories}
            homePosition={homePosition}
            addingMode={addingMode}
            onMapClick={handleMapClick}
          />
        )}

        {/* 🔹 Hint text */}
        {!addingMode && (
          <div className="w-fit absolute bottom-[20px] left-1/2 -translate-x-1/2 z-[950]">
            <GradientText
              colors={[
                "#9f9f9fff",
                "#3c3c3cff",
                "#adadadff",
                "#3c3c3cff",
                "#727272ff",
              ]}
              animationSpeed={5}
              showBorder={false}
              className="font-semibold text-[1rem] whitespace-nowrap"
            >
              &lt;&lt;Click on any marker to view memories from that location&gt;&gt;
            </GradientText>
          </div>
        )}

       {addingMode && (
         <button
           onClick={() => {
             if (!navigator.geolocation) {
               alert("Geolocation is not supported by your browser.");
               return;
             }
       
             navigator.geolocation.getCurrentPosition(
               (pos) => {
                 const { latitude, longitude } = pos.coords;
                 const latlng = { lat: latitude, lng: longitude };
                 setSelectedPosition(latlng);
                 setShowForm(true);
                 setAddingMode(false);
               },
               (err) => {
                 if (err.code === 1) {
                   alert(
                     "Location access denied. Please enable location permission for this website in your browser settings."
                   );
                 } else if (err.code === 2) {
                   alert("Location unavailable. Try again in a few seconds.");
                 } else {
                   alert("Failed to get location. Please try again.");
                 }
               },
               { enableHighAccuracy: true, timeout: 10000 }
             );
           }}
           className="absolute w-[50px] aspect-square bottom-[20px] left-[80px] bg-dborderColor text-dtxt text-[2rem] grid place-content-center rounded-full shadow-md hover:bg-dlightMain2 transition-all z-[1000]"
           title="Add memory at your current location"
         >
           <Locate />
         </button>
       )}

        <div className="w-fit h-fit flex-col bottom-[20px] left-[20px] absolute z-[1000] "> 
           
             {/* 🔹 Overlay Button */}
           <button onClick={()=>{toggleFollowingList();fetchFollowing();}} className=" text-dtxt bg-dlightMain border-[1px] dark:border-dborderColor border-borderColor mb-[10px] dark:text-dtxt w-[50px] aspect-square shadow-xl grid place-content-center text-[2rem] rounded-full">
              <Layers2 />
           </button>
           
           {/* 🔹 Add / Cancel Button */}
           <button
             onClick={() => {
               setAddingMode((prev) => !prev);
               setSelectedPosition(null);
             }}
             className={`w-[50px] aspect-square shadow-xl grid place-content-center text-[2rem] rounded-full transition-all ${
               addingMode
                 ? "bg-red-500 rotate-45 text-white"
                 : "bg-main text-txt"
             }`}
             title={addingMode ? "Cancel adding memory" : "Add new memory"}
           >
             +
           </button>
        </div> 

        {(followList)?
        <div className="absolute z-[1000] left-[80px] bottom-[80px] w-[200px] h-fit rounded-md overflow-hidden dark:bg-dlightMain bg-lightMain border-[1px] border-borderColor dark:border-dborderColor">
          <section className="w-full dark:bg-dmain bg-main  text-center h-[40px] flex items-center justify-center border-b-[1px] border-borderColor dark:border-dborderColor">
             <p className="text-[1.1rem] font-semibold text-transparent bg-clip-text bg-gradient-main ">Friend's Pins</p>
             <button onClick={toggleFollowingList} className="absolute right-1 scale-[0.8]"><X/></button>
          </section>

         {following.length === 0 ? (
  <section className="w-full h-fit text-center">
    <p className="h-fit px-2 py-2">
      Follow people to see their pins
    </p>
  </section>
     ) : (
  <section className="w-full min-h-fit max-h-[122px] overflow-y-auto scrollbar-custom">
   {following.map((people) => ( 
  <div 
    key={people._id} 
    className="w-full h-fit flex items-center dark:hover:bg-dlightMain2 hover:bg-main bg-lightMain dark:bg-dlightMain border-b-[1px] border-borderColor dark:border-dborderColor cursor-pointer" 
    onClick={() => {
      const checkbox = document.getElementById(`chk-${people._id}`);
      if (checkbox) checkbox.click();
    }}
    onDoubleClick={() => navigate(`/profile/${people._id}`)} 
  > 
    <div className="w-fit h-fit px-2 flex items-center"> 
      <div 
        onClick={(e) => e.stopPropagation()} 
        onDoubleClick={(e) => e.stopPropagation()} 
        className="mr-3" 
      > 
        <label 
          htmlFor={`chk-${people._id}`} 
          className=" 
            w-4 h-4 rounded 
            border border-borderColor dark:border-dborderColor
            bg-white dark:bg-black 
            flex items-center justify-center 
            cursor-pointer 
            relative 
          " 
        > 
          <input 
            type="checkbox" 
            id={`chk-${people._id}`} 
            className="absolute opacity-0 peer"
            checked={activePinPeople.includes(people._id)} //to remember who is already checked
            onChange={(e) => {
              if (e.target.checked) {
                setActivePinPeople(prev => [...prev, people._id]);
              } else {
                setActivePinPeople(prev =>
                  prev.filter(id => id !== people._id)
                );
              }
            }} 
          /> 
          <svg 
            className=" 
              w-3 h-3 
              text-black dark:text-white 
              hidden peer-checked:block 
            " 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            viewBox="0 0 24 24" 
          > 
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M5 13l4 4L19 7" 
            /> 
          </svg> 
        </label> 
      </div> 
      {people.profilePic ? ( 
        <img 
          src={people.profilePic} 
          className="w-6 h-6 mr-2 rounded-full border-1 border-main dark:border-dmain object-cover" 
        /> 
      ) : ( 
        <div className="w-6 h-6 mr-2 rounded-full bg-gray-300 flex items-end justify-center overflow-hidden"> 
          <i className="fa-solid fa-user text-[1rem] text-gray-500"></i> 
        </div> 
      )} 

      <div className="flex flex-col py-2 text-left"> 
        <span className="text-txt dark:text-dtxt font-semibold"> 
          {shortenText(people.name,12)} 
        </span> 
      </div> 
    </div> 
  </div> 
))}
  </section>
   )}
   {following.length !== 0 ? (
   <section className="w-full h-[45px] flex gap-2 items-center p-2">
       <button 
         className="bg-dmain h-full text-dtxt dark:bg-main rounded-sm dark:text-txt w-full"
         onClick={() => {
           following.forEach((people) => {
             const checkbox = document.getElementById(`chk-${people._id}`);
             if (checkbox && checkbox.checked) {
               checkbox.checked = false;
             }
           });
           setActivePinPeople([]);
         }}
       >
         Clear
       </button>
       <button onClick={applyFilter} className="bg-gradient-main rounded-sm text-dtxt h-full w-full">
         {applyLoading?
         <p>Applying...</p>
         :
         <p>Apply</p>
         }
        </button>
   </section>)
   :
   <></>
   }
        </div>
        :
        <></>
        }
        {/* 🔹 Bottom gradient */}
        <div className="gradientContainerBottom absolute z-[900] h-[50px] bg-[linear-gradient(to_top,theme(colors.fadeColor)_0%,transparent_100%)] 
          dark:bg-[linear-gradient(to_top,theme(colors.dfadeColor)_0%,transparent_100%)] bottom-0 w-full" />

        {/* 🔹 Add Memory Form */}
        {showForm && selectedPosition && (
          <AddMemoryForm position={selectedPosition} onClose={handleFormClose}
           onAdd={(newMemory) => {
              // Add new memory to your list
              setMemories(prev => [...prev, newMemory]);
              setShowForm(false);} // close the form}
           } />
        )}
      </div>
    </div>
  );
};

export default HomePage;
