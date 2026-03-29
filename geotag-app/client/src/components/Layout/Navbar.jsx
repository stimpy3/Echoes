import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { NavLink } from "react-router-dom";
import { MoonStar, SunMedium, LogOut, Settings, ChartNoAxesColumn, MapPinHouse, Bell, MessageCircleMore, Globe, Lock, Menu, X } from 'lucide-react';

import { useTheme } from "../../context/ThemeContext";
import { useHome } from '../../context/HomeContext';
import axios from "axios";
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  const { homePosition } = useHome();
  const { dark, setDark } = useTheme();

  const [showSettings, setShowSettings] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notifCount = notifications.length;

  const [openNotif, setOpenNotif] = useState(false);
  const notifRef = useRef(null);
  const settingsRef = useRef(null);

  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

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

  const handleFollowConfirm = async (senderId, notifId) => {
    await axios.post(`${BASE_URL}/api/follow/confirm`, { senderId }, { withCredentials: true });
    setNotifications(prev => prev.filter(n => n._id !== notifId));
  };

  const handleDeleteNotif = async (notifId) => {
    await axios.delete(`${BASE_URL}/api/follow/notifications/${notifId}`, { withCredentials: true });
    setNotifications(prev => prev.filter(n => n._id !== notifId));
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setOpenNotif(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/user/navbar`, { withCredentials: true });
        setName(res.data.name);
        setEmail(res.data.email);
        setProfilePic(res.data.profilePic);
        setIsPrivate(res.data.isPrivate);
      }
      catch (err) {
        console.error("Error fetching user data:", err.response?.data || err.message);
      }
    };
    fetchUser();
  }, []);

  const handlePrivacyToggle = async () => {
    try {
      const newStatus = !isPrivate;
      const res = await axios.patch(`${BASE_URL}/api/user/privacy`, { isPrivate: newStatus }, { withCredentials: true });
      setIsPrivate(res.data.isPrivate);
    } catch (err) {
      console.error("Error updating privacy:", err);
    }
  };

  const logOutUser = async () => {
    try {
      await axios.post(`${BASE_URL}/api/auth/logout`, {}, { withCredentials: true });
      navigate('/');
    }
    catch (err) {
      console.error("Error logging out:", err.response?.data || err.message);
    }
  };

  const handlehomeLocation = () => {
    setShowSettings(false);
    navigate('/homelocation');
  };
  const handleChat = () => navigate('/chat');

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/follow/notifications`, { withCredentials: true });
        setNotifications(res.data);
      } catch (err) {
        console.log("Notif fetch error:", err);
      }
    };
    fetchNotifications();
  }, []);

  return (
    <nav className="transparent bg-[linear-gradient(to_bottom,theme(colors.fadeColor)_10%,transparent_100%)] 
          dark:bg-[linear-gradient(to_bottom,theme(colors.dfadeColor)_10%,transparent_100%)] fixed z-[999] top-[0px] py-[5px] left-0 right-0 px-[10px] sm:px-[20px]">
      <div className="flex justify-between items-center h-[50px] relative z-10 gap-2">
        {/* Logo/Brand */}
        <Link to="/home" className="flex items-center space-x-2">
          <div className='bg-[url("/logo.png")] bg-contain bg-no-repeat aspect-[445/549] h-[35px]'></div>
        </Link>

        {/* Navigation Links */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center space-x-[12px] py-[5px] px-[5px] h-full bg-main/50 dark:bg-dborderColor/50 backdrop-blur-[2px] border-[1px] border-borderColor dark:border-dborderColor rounded-full">
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

          <NavLink to="/explore" className={({ isActive }) =>
            `p-[5px] h-full flex items-center justify-center rounded-full text-[1.2rem] w-[80px] text-center
                     text-sm font-medium ${isActive ?
              "bg-dmain text-white dark:bg-main dark:text-black"
              :
              "text-black dark:text-white"} 
                    `
          }
          >
            Explore
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
        </div>

        <div className='w-fit h-[50px] flex items-center gap-2 sm:gap-4'>
          <div className="relative" ref={notifRef}>
            <button onClick={() => setOpenNotif(prev => !prev)} className="flex text-borderColor dark:text-dlightTxt items-center justify-center h-full w-full relative">
              <Bell className="scale-[0.9]" />
              {notifCount > 0 && (
                <span className="absolute top-[-5px] -right-1 bg-red-500 text-white text-[0.65rem] font-semibold px-[6px] py-[1px] rounded-full">
                  {notifCount}
                </span>
              )}
            </button>

            {/* Dropdown Notif */}
            {openNotif && (
              <div className="absolute right-0 top-[48px] w-[min(92vw,360px)] p-[5px] bg-white dark:bg-dborderColor border border-borderColor dark:border-dborderColor shadow-lg rounded-md backdrop-blur-md">
                {notifications.length === 0 ? (
                  <p className="text-sm text-txt p-[2px] w-fit dark:text-dtxt whitespace-nowrap">No notifications yet</p>
                ) : (
                  notifications.map((req, i) => (
                    <div key={i} className="flex items-center min-w-0 justify-between gap-2 py-1 border-b border-gray-300 last:border-none">
                      {req.sender.profilePic ? (
                        <img src={req.sender.profilePic} alt="pfp" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="aspect-square w-8 h-8 border-[1px] bg-gray-400 dark:bg-[#393939] rounded-full flex justify-center items-center overflow-hidden">
                          <i className="fa-solid fa-user text-[1rem] text-gray-200 dark:text-gray-400"></i>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-[0.8rem] text-txt dark:text-dtxt font-medium">{req.sender.name} sent follow request</p>
                        <p className="text-[0.6rem] text-gray-400">{formatDate(req.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleFollowConfirm(req.sender._id, req._id)} className="px-2 py-1 text-xs bg-gradient-main text-white rounded-md">Accept</button>
                        <button onClick={() => handleDeleteNotif(req._id)} className="px-2 py-1 text-xs bg-dlightMain text-white rounded-md">X</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button onClick={handleChat} className="flex text-borderColor dark:text-dlightTxt items-center justify-center">
            <MessageCircleMore />
          </button>

          <div className="hidden md:flex items-center gap-2">

            {/* Settings Button */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettings(prev => !prev)}
                className={`p-2 rounded-full transition-all duration-300 ${showSettings ? "bg-main text-black rotate-90" : "text-borderColor dark:text-dlightTxt hover:bg-white/10"}`}
              >
                <Settings size={22} />
              </button>

              {showSettings && (
                <div className="absolute right-0 top-[45px] w-[220px] bg-white/95 dark:bg-dborderColor/95 backdrop-blur-md border border-borderColor dark:border-dborderColor shadow-2xl rounded-xl p-2 animate-in fade-in zoom-in duration-200">
                  {/* Account Info (Header) */}
                  <div className="px-3 py-2 mb-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</p>
                    <p className="text-sm font-medium text-txt dark:text-dtxt truncate">{name}</p>
                    <p className="text-[0.7rem] text-lightTxt dark:text-dlightTxt truncate">{email}</p>
                  </div>

                  {/* Privacy Toggle */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition mb-1 cursor-pointer" onClick={handlePrivacyToggle}>
                    <div className="flex items-center gap-2 text-txt dark:text-dtxt">
                      {isPrivate ? <Lock size={16} className="text-red-500" /> : <Globe size={16} className="text-green-500" />}
                      <span className="text-sm">{isPrivate ? "Private Account" : "Public Account"}</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full relative transition-colors ${isPrivate ? "bg-red-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isPrivate ? "right-0.5" : "left-0.5"}`} />
                    </div>
                  </div>

                  {/* Home Location */}
                  <button onClick={handlehomeLocation} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-txt dark:text-dtxt transition mb-1">
                    <MapPinHouse size={16} />
                    <span className="text-sm">Home Location</span>
                  </button>

                  {/* Theme Toggle */}
                  <button onClick={() => setDark(prev => !prev)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-txt dark:text-dtxt transition mb-1">
                    {dark ? <SunMedium size={16} /> : <MoonStar size={16} />}
                    <span className="text-sm">{dark ? "Light Mode" : "Dark Mode"}</span>
                  </button>

                  {/* Analytics */}
                  <NavLink to="/analytics" onClick={() => setShowSettings(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-txt dark:text-dtxt transition mb-1">
                    <ChartNoAxesColumn size={16} />
                    <span className="text-sm">Analytics</span>
                  </NavLink>

                  {/* Logout */}
                  <button onClick={logOutUser} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-500 transition mt-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                    <LogOut size={16} />
                    <span className="text-sm font-medium">Log Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* Circle PFP (Clickable to Profile) */}
            <div onClick={() => navigate('/profile')} className="w-[40px] h-[40px] rounded-full overflow-hidden border-[1px] border-borderColor dark:border-dborderColor cursor-pointer transition active:scale-95">
              {profilePic ? (
                <img src={profilePic} alt="pfp" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-400 dark:bg-[#393939] flex items-end justify-center">
                  <i className="fa-solid fa-user text-[1.5rem] text-gray-200 dark:text-gray-400"></i>
                </div>
              )}
            </div>

          </div>

          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-full text-borderColor dark:text-dlightTxt hover:bg-white/10"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden mt-2 rounded-xl border border-borderColor dark:border-dborderColor bg-main/80 dark:bg-dborderColor/80 backdrop-blur-md p-2">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <NavLink
              to="/home"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `px-2 py-2 rounded-lg text-center text-sm font-medium ${isActive ? "bg-dmain text-white dark:bg-main dark:text-black" : "text-black dark:text-white bg-white/30 dark:bg-black/20"}`
              }
            >
              Map
            </NavLink>
            <NavLink
              to="/explore"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `px-2 py-2 rounded-lg text-center text-sm font-medium ${isActive ? "bg-dmain text-white dark:bg-main dark:text-black" : "text-black dark:text-white bg-white/30 dark:bg-black/20"}`
              }
            >
              Explore
            </NavLink>
            <NavLink
              to="/timeline"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `px-2 py-2 rounded-lg text-center text-sm font-medium ${isActive ? "bg-dmain text-white dark:bg-main dark:text-black" : "text-black dark:text-white bg-white/30 dark:bg-black/20"}`
              }
            >
              Timeline
            </NavLink>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/profile');
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/30 dark:bg-black/20 text-txt dark:text-dtxt text-sm"
            >
              Profile
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handlehomeLocation();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/30 dark:bg-black/20 text-txt dark:text-dtxt text-sm"
            >
              Home
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/analytics');
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/30 dark:bg-black/20 text-txt dark:text-dtxt text-sm"
            >
              Analytics
            </button>
            <button
              onClick={() => setDark((prev) => !prev)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/30 dark:bg-black/20 text-txt dark:text-dtxt text-sm"
            >
              {dark ? "Light" : "Dark"}
            </button>
            <button
              onClick={handlePrivacyToggle}
              className="w-full col-span-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/30 dark:bg-black/20 text-txt dark:text-dtxt text-sm"
            >
              {isPrivate ? "Private Account" : "Public Account"}
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logOutUser();
              }}
              className="w-full col-span-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm"
            >
              Log Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;