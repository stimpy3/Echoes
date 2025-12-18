import { Link } from 'react-router-dom';
import { useState,useEffect,useRef } from 'react';
import { NavLink } from "react-router-dom";
import { MoonStar,SunMedium,LogOut,ChevronDown,User,ChartNoAxesColumn, MapPinHouse,Bell,MessageCircleMore } from 'lucide-react';

import { useTheme } from "../../context/ThemeContext";
import { useHome } from '../../context/HomeContext';
import Modal from "./Modal";
import axios from "axios";
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
   const navigate = useNavigate();
   const { homePosition } = useHome();
   const { dark, setDark } = useTheme();

   const [showProfileOptions, setShowProfileOptions] = useState(false);
   const [openModal, setOpenModal] = useState(false);
   const [name,setName]=useState("");
   const [email,setEmail]=useState("");
   const [address,setAddress]=useState("");
   const [profilePic,setProfilePic]=useState("");
   const [addrLoading, setAddrLoading] = useState(false);
   const [notifications, setNotifications] = useState([]);
   const notifCount = notifications.length;

   const [openNotif, setOpenNotif] = useState(false);
   const notifRef = useRef(null);

  const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
  return `${years} year${years > 1 ? "s" : ""} ago`;
};

const BASE_URL=import.meta.env.VITE_BASE_URL || "http://localhost:5000";

const handleFollowConfirm = async (senderId, notifId) => {
  await axios.post(`${BASE_URL}/api/follow/confirm`, { senderId },{ withCredentials: true });
  setNotifications(prev => prev.filter(n => n._id !== notifId));  //remove from UI
};

const handleDeleteNotif = async (notifId) => {
  await axios.delete(`${BASE_URL}/api/follow/notifications/${notifId}`,{ withCredentials: true });
  setNotifications(prev => prev.filter(n => n._id !== notifId));
};
 

  useEffect(() => {
  const handleClickOutside = (e) => {
    if (notifRef.current && !notifRef.current.contains(e.target)) {
      setOpenNotif(false);
    }
    };

   document.addEventListener("mousedown", handleClickOutside);
   return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
   

   useEffect(() => {
  const fetchAddress = async () => {
    if (!homePosition || !homePosition.lat || !homePosition.lng) return;

    try {
      setAddrLoading(true);

      // Nominatim reverse geocoding
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        homePosition.lat
      )}&lon=${encodeURIComponent(homePosition.lng)}&accept-language=en`;

      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'EchoesGeotagApp/1.0 (your-email@example.com)'
        }
      });

      if (res.data && res.data.display_name) {
        // Terms to filter out
        const unwantedTerms = [
          'taluka', 
          'tehsil', 
          'subdivision',
          'ward',
          'zone',
          'suburban'
        ];
        
        // Clean duplicates and filter unwanted terms
        const parts = res.data.display_name.split(",").map(p => p.trim());
        const seen = new Set();
        const cleaned = [];

        for (let part of parts) {
          const lower = part.toLowerCase();
          
          // Check if part contains any unwanted term
          const hasUnwantedTerm = unwantedTerms.some(term => 
            lower.includes(term)
          );
          
          if (!seen.has(lower) && !hasUnwantedTerm) {
            cleaned.push(part);
            seen.add(lower);
          }
        }

        setAddress(cleaned.join(", "));
      } else if (res.data && res.data.address) {
        setAddress(JSON.stringify(res.data.address));
      } else {
        setAddress("");
      }
    } catch (err) {
      console.error('Nominatim reverse geocode error:', err.response?.data || err.message || err);
      setAddress("");
    } finally {
      setAddrLoading(false);
    }
  };

  fetchAddress();
}, [homePosition]);

    //chat redirect
    const handleChat=()=>{
    navigate('/chat');
    }
  

   const logOutUser = async () => {
   try {
      await axios.post(`${BASE_URL}/api/auth/logout`, {}, { withCredentials: true });
      navigate('/');
    }
   catch (err) {
    console.error("Error logging out:", err.response?.data || err.message);
   }
   };


   const handlehomeLocation=()=>{
    navigate('/homelocation');
   };


   useEffect(() => {
  const fetchNotifications = async () => {
    try {
      const res = await axios.get(
        `${BASE_URL}/api/follow/notifications`,
        { withCredentials: true }
      );
      setNotifications(res.data);
    } catch (err) {
      console.log("Notif fetch error:", err);
    }
  };

  fetchNotifications();
}, []);

 


  return (
       <nav className="transparent bg-[linear-gradient(to_bottom,theme(colors.fadeColor)_10%,transparent_100%)] 
          dark:bg-[linear-gradient(to_bottom,theme(colors.dfadeColor)_10%,transparent_100%)] fixed z-[999] top-[0px] py-[5px] left-0 right-0 px-[20px]">
        <div className="flex justify-between items-center h-[50px] relative z-10">
          {/* Logo/Brand */}
          <Link to="/home" className="flex items-center space-x-2">
            <div className='bg-[url("/logo.png")] bg-contain bg-no-repeat aspect-[445/549] h-[35px]'></div>
          </Link>

          {/* Navigation Links */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-[12px] py-[5px] px-[5px] h-full bg-main/50 dark:bg-dborderColor/50 backdrop-blur-[2px] border-[1px] border-borderColor dark:border-dborderColor rounded-full">
                <NavLink to="/home" className={({ isActive }) =>
                    `p-[5px] h-full flex items-center justify-center rounded-full text-[1.2rem] w-[80px] text-center
                     text-sm font-medium ${isActive ? 
                      "bg-dmain text-white dark:bg-main dark:text-black"
                      : 
                      "text-black dark:text-white"} 
                    `
                  }
                >
                  Map
                </NavLink>
                
                <NavLink to="/profile" className={({ isActive }) =>
                    `p-[5px] h-full flex items-center justify-center rounded-full text-[1.2rem] w-[80px] text-center
                     text-sm font-medium ${isActive ? 
                      "bg-dmain text-white dark:bg-main dark:text-black"
                      : 
                      "text-black dark:text-white"} 
                    `
                  }
                >
                  Profile
                </NavLink>

                <NavLink to="/timeline" className={({ isActive }) =>
                    `p-[5px] h-full flex items-center justify-center rounded-full text-[1.2rem] w-[80px] text-center
                     text-sm font-medium ${isActive ? 
                      "bg-dmain text-white dark:bg-main dark:text-black"
                      : 
                      "text-black dark:text-white"} 
                    `
                  }
                >
                  Timeline
                </NavLink>
                
                {/* <button
                  onClick={() => setIsLoggedIn(false)}
                    className="bg-red-500 text-white px-[16px] py-[8px] rounded-md text-sm font-medium hover:bg-red-600"
                >
                  Logout
                </button> */}
          </div>

         <div className='w-fit h-[50px] flex'>

          <div className="relative mr-5" ref={notifRef}>
           {/* Bell Button */}
           <button
             onClick={() => setOpenNotif(prev => !prev)}
             className="flex text-borderColor dark:text-dlightTxt items-center justify-center h-full w-full relative"
           >
             <Bell className="scale-[0.9]" />
         
             {/*Notification Badge */}
             {notifCount > 0 && (
               <span className="absolute top-[5px] -right-1 bg-red-500 text-white text-[0.65rem] font-semibold px-[6px] py-[1px] rounded-full">
                 {notifCount}
               </span>
             )}
           </button>
         
           {/* Dropdown */}
           {openNotif && (
             <div className="absolute right-0 top-[48px] w-fit p-[5px] bg-white dark:bg-dborderColor border border-borderColor dark:border-dborderColor shadow-lg rounded-md backdrop-blur-md">
         
               {notifications.length === 0 ? (
                  <p className="text-sm text-txt p-[2px] w-fit dark:text-dtxt whitespace-nowrap">No notifications yet</p>
                ) : (
                  notifications.map((req, i) => (
                    <div
                      key={i}
                      className="flex items-center min-w-[320px] justify-between gap-2 py-1 border-b border-gray-300 last:border-none"
                    >
                
                      {/* Avatar */}
                      {req.sender.profilePic ? (
                        <img
                          src={req.sender.profilePic}
                          alt="pfp"
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="aspect-square w-8 h-8 border-[1px] bg-gray-400 dark:bg-[#393939] rounded-full flex justify-center items-center overflow-hidden">
                          <i className="fa-solid fa-user text-[1rem] text-gray-200 dark:text-gray-400"></i>
                        </div>
                      )}
                
                      {/* Content */}
                      <div className="flex-1">
                        <p className="text-[0.8rem] text-txt dark:text-dtxt font-medium">
                          {req.sender.name} sent you a follow request
                        </p>
                        <p className="text-[0.6rem] text-gray-400">
                           {formatDate(req.createdAt)}
                        </p>
                      </div>
                
                      {/* Buttons */}
                      <div className="flex items-center gap-2">
                        {/* ACCEPT */}
                        <button
                          onClick={() => handleFollowConfirm(req.sender._id, req._id)}
                          className="px-2 py-1 text-xs bg-gradient-main text-white rounded-md"
                        >
                          Accept
                        </button>
                
                        {/* DELETE */}
                        <button
                          onClick={() => handleDeleteNotif(req._id)}
                          className="px-2 py-1 text-xs bg-dlightMain text-white rounded-md"
                        >
                          X
                        </button>
                      </div>
                
                    </div>
                  ))
                )}

             </div>
           )}
         </div>


         
         <button onClick={handlehomeLocation} className="flex text-borderColor dark:text-dlightTxt items-center justify-center h-full w-full mr-5">
           < MapPinHouse/>
         </button>
         
         <button onClick={handleChat} className="flex text-borderColor dark:text-dlightTxt items-center justify-center h-full w-full mr-5">
           <MessageCircleMore/>
         </button>

         

          <section className='relative flex items-center text-black h-full bg-white/20 dark:bg-dborderColor/50 backdrop-blur-[2px] border-[1px]
           border-borderColor dark:border-dborderColor rounded-full' onMouseLeave={() => setShowProfileOptions(false)}>      
             
   
             <div className="overflow-hidden flex w-[50px] h-full bg-main/50 dark:bg-dborderColor/50 backdrop-blur-[2px] rounded-full hover:w-[200px] transition-all duration-300">           
                 {profilePic?
                
                  <img src={profilePic} alt="pfp" className="border-borderColor w-[50px] h-[50px] rounded-full object-cover"/>

                 :
                 <div className="aspect-square min-w-[50px] border-[1px] bg-gray-400 dark:bg-[#393939] dark:border-dmain rounded-full flex justify-center items-end overflow-hidden">
                     <i className="fa-solid fa-user text-[2rem] text-gray-200 dark:text-gray-400"></i>
                 </div>
                 }
                 
  
                 <div className="p-[5px] w-full flex justify-between">
                     <section className="flex flex-col justify-center">
                       <p className='text-[0.9rem] text-txt dark:text-dtxt'>{`${(name?.length)>10?name.slice(0,9)+"...":name}`}</p>
                       <p className='text-[0.6rem] text-lightTxt dark:text-dlightTxt'>{`${email?.length>18?email.slice(0,17)+"...":email}`}</p>
                     </section>
                     <button className="flex items-center justify-center text-txt dark:text-dtxt h-full p-[5px] border-l-[1px] border-[#565656]"
                       onClick={() => setShowProfileOptions(prev => !prev)}>
                       <ChevronDown/>
                     </button>
                 </div>      
             </div>

            {(showProfileOptions)?
              <div className="profileOptions absolute top-[50px] rounded-md right-[0px] h-fit w-fit bg-white/95 dark:bg-dborderColor/95 backdrop-blur-md border-[1px]
           border-borderColor dark:border-dborderColor shadow-lg p-[5px]">
                  
                   
                   <button onClick={() => setDark(prev => !prev)} className="flex text-borderColor dark:text-dlightTxt items-center justify-start h-full w-full">
                     {dark ? (
                       <div className="flex justify-start text-[0.9rem] text-lightTxt dark:text-dlightTxt"><SunMedium className=" transition-all duration-300 pr-[5px]" /> <p>Light Mode</p></div>
                     ) : (
                        <div className="flex justify-start text-[0.9rem] text-lightTxt dark:text-dlightTxt"><MoonStar className=" transition-all duration-300 pr-[5px]" /><p>Dark Mode</p></div>
                     )}
                   </button>
                   <NavLink to="/analytics" className='text-[0.9rem] h-full flex py-[5px] w-full border-t-[1px] border-borderColor dark:border-dborderColor text-lightTxt dark:text-dlightTxt'>
                      <ChartNoAxesColumn className='scale-[0.8]' /><p className='pl-[5px] whitespace-nowrap w-[90px] flex justify-start'>Analytics</p>
                   </NavLink>

                  
        
                  <button className="text-[0.9rem] h-full flex  justify-start py-[5px] border-t-[1px] border-borderColor dark:border-dborderColor text-lightTxt dark:text-dlightTxt w-full"
                          onClick={logOutUser} >
                    <LogOut className='scale-[0.8]' /><p className='pl-[5px] whitespace-nowrap w-[90px] flex justify-start'>Log Out</p>
                  </button>
             </div>
             :
             <></>
            }       
          </section>
          </div>

        </div>

    </nav>
  );
};

export default Navbar;