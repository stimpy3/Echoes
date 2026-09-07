import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  MoonStar, SunMedium, LogOut, Settings, MapPinHouse,
  MessageCircle, Globe, Lock, Users, X, Map as MapIcon, Search, BookOpen, User, Bell,
} from 'lucide-react';

import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';
import { socket } from '../../utils/socket';
import { clearCsrfToken } from '../../utils/csrf';

/*
Desktop chrome only — the 76px rail. Mobile keeps its own top bar / tab bar
(components/Layout/MobileNav.jsx); this component renders nothing below the md breakpoint.

The four primary destinations of a travel diary: where you've been, what you wrote, who you
were with, and finding any of it again. Trips deliberately has no rail item of its own — it's
the second tab of the Diary screen, which keeps this list at four.
*/
const RAIL_ITEMS = [
  { to: '/home', label: 'Map', icon: MapIcon },
  { to: '/timeline', label: 'Diary', icon: BookOpen },
  { to: '/copresence', label: 'People', icon: Users },
  { to: '/search', label: 'Search', icon: Search },
];

const BOTTOM_ITEMS = [
  { to: '/chat', label: 'Chat', icon: MessageCircle },
];

const Rail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { dark, setDark } = useTheme();

  const [showSettings, setShowSettings] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [coPresenceOptIn, setCoPresenceOptIn] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [coPresenceCandidates, setCoPresenceCandidates] = useState([]);
  const notifCount = notifications.length + coPresenceCandidates.length;

  const settingsRef = useRef(null);
  const notifRef = useRef(null);
  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    return `${years} year${years > 1 ? 's' : ''} ago`;
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/user/navbar`, { withCredentials: true });
        setName(res.data.name);
        setEmail(res.data.email);
        setProfilePic(res.data.profilePic);
        setIsPrivate(res.data.isPrivate);
        setCoPresenceOptIn(Boolean(res.data.coPresenceOptIn));
      } catch (err) {
        console.error('Error fetching user data:', err.response?.data || err.message);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/follow/notifications`, { withCredentials: true });
        setNotifications(res.data);
      } catch (err) {
        console.log('Notif fetch error:', err);
      }
    };
    fetchNotifications();
  }, []);

  // Phase 5. A separate effect/endpoint from follow-request notifications — co-presence
  // suggestions are a different kind of thing with a different backend.
  useEffect(() => {
    const fetchCoPresencePending = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/copresence/pending`, { withCredentials: true });
        setCoPresenceCandidates(res.data);
      } catch (err) {
        console.log('Co-presence pending fetch error:', err);
      }
    };
    fetchCoPresencePending();
  }, []);

  const handleFollowConfirm = async (senderId, notifId) => {
    await axios.post(`${BASE_URL}/api/follow/confirm`, { senderId }, { withCredentials: true });
    setNotifications(prev => prev.filter(n => n._id !== notifId));
  };

  const handleDeleteNotif = async (notifId) => {
    await axios.delete(`${BASE_URL}/api/follow/notifications/${notifId}`, { withCredentials: true });
    setNotifications(prev => prev.filter(n => n._id !== notifId));
  };

  const handleCoPresenceConfirm = async (candidateId) => {
    try {
      await axios.post(`${BASE_URL}/api/copresence/${candidateId}/confirm`, {}, { withCredentials: true });
      setCoPresenceCandidates(prev => prev.filter(c => c._id !== candidateId));
    } catch (err) {
      console.error('Error confirming co-presence suggestion:', err);
    }
  };

  const handleCoPresenceReject = async (candidateId) => {
    try {
      await axios.post(`${BASE_URL}/api/copresence/${candidateId}/reject`, {}, { withCredentials: true });
      setCoPresenceCandidates(prev => prev.filter(c => c._id !== candidateId));
    } catch (err) {
      console.error('Error rejecting co-presence suggestion:', err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setShowSettings(false);
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handlePrivacyToggle = async () => {
    try {
      const newStatus = !isPrivate;
      const res = await axios.patch(`${BASE_URL}/api/user/privacy`, { isPrivate: newStatus }, { withCredentials: true });
      setIsPrivate(res.data.isPrivate);
    } catch (err) {
      console.error('Error updating privacy:', err);
    }
  };

  const handleCoPresenceToggle = async () => {
    try {
      const newStatus = !coPresenceOptIn;
      const res = await axios.patch(
        `${BASE_URL}/api/user/co-presence-opt-in`,
        { optIn: newStatus },
        { withCredentials: true }
      );
      setCoPresenceOptIn(Boolean(res.data.coPresenceOptIn));
    } catch (err) {
      console.error('Error updating co-presence opt-in:', err);
    }
  };

  const logOutUser = async () => {
    try {
      await axios.post(`${BASE_URL}/api/auth/logout`, {}, { withCredentials: true });
      socket.disconnect();
      clearCsrfToken();
      navigate('/');
    } catch (err) {
      console.error('Error logging out:', err.response?.data || err.message);
    }
  };

  const handlehomeLocation = () => {
    setShowSettings(false);
    navigate('/homelocation');
  };

  const isProfileActive = location.pathname.startsWith('/profile');

  return (
    <nav className="hidden md:flex flex-none w-[76px] h-screen sticky top-0 flex-col items-center bg-main dark:bg-[#111] border-r border-hairline dark:border-transparent py-[18px] gap-[6px] z-[999]">
      <NavLink to="/home" className="mb-5">
        <img src="/logo.png" alt="Echoes" className="h-[30px] w-auto dark:hidden" />
        <img src="/lightLogo.png" alt="Echoes" className="h-[30px] w-auto hidden dark:block" />
      </NavLink>

      {/* Notification bell — follow requests + co-presence suggestions. Was silently
          dropped when Navbar.jsx's dropdown got folded into this rail; only the count
          survived, moved onto the Chat item's dot. Restoring the actual tray here since
          that count needs somewhere to lead to. */}
      <div className="relative mb-1" ref={notifRef}>
        <button
          type="button"
          onClick={() => setShowNotif((prev) => !prev)}
          aria-label={notifCount > 0 ? `Notifications (${notifCount} unread)` : 'Notifications'}
          aria-expanded={showNotif}
          aria-haspopup="true"
          className="relative flex flex-col items-center justify-center w-[52px] h-[52px] rounded-xl gap-[3px] transition-colors text-txt2 dark:text-[#8a8a8a] hover:text-txt dark:hover:text-white
                     focus-visible:ring-2 focus-visible:ring-accentMain focus-visible:ring-offset-2 focus-visible:ring-offset-main dark:focus-visible:ring-offset-[#111]"
        >
          <Bell size={21} strokeWidth={1.8} />
          <span className="text-[9.5px] leading-none">Alerts</span>
          {notifCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-[8px] right-[10px] w-[7px] h-[7px] rounded-full bg-gradient-main ring-[1.5px] ring-main dark:ring-[#111]"
            />
          )}
        </button>

        {showNotif && (
          <div className="absolute left-[64px] top-0 w-[340px] max-h-[70vh] overflow-y-auto custom-scrollbar bg-main/95 dark:bg-[#161616]/95 backdrop-blur-md border border-hairline dark:border-dhairline shadow-2xl rounded-xl p-2 z-50">
            {notifications.length === 0 && coPresenceCandidates.length === 0 ? (
              <p className="text-sm text-txt2 dark:text-[#8a8a8a] p-3">No notifications yet</p>
            ) : (
              <>
                {coPresenceCandidates.map((c) => (
                  <div key={c._id} className="flex items-center min-w-0 justify-between gap-2 p-2 border-b border-hairline dark:border-dhairline last:border-none">
                    {c.otherUser?.profilePic ? (
                      <img src={c.otherUser.profilePic} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-lightMain2 dark:bg-[#393939] flex justify-center items-center shrink-0">
                        <Users size={14} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-txt dark:text-white font-medium truncate">
                        {c.myConfirmed ? `Waiting on ${c.otherUser?.name} to confirm` : `Were you with ${c.otherUser?.name}?`}
                      </p>
                      <p className="text-[11px] text-txt2 dark:text-[#8a8a8a]">Based on where and when you both posted</p>
                    </div>
                    {!c.myConfirmed && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => handleCoPresenceConfirm(c._id)} className="px-2 py-1 text-xs bg-gradient-main text-white rounded-md">
                          Yes
                        </button>
                        <button
                          onClick={() => handleCoPresenceReject(c._id)}
                          aria-label={`Not with ${c.otherUser?.name}`}
                          className="p-1 text-xs bg-lightMain2 dark:bg-dlightMain text-txt dark:text-white rounded-md flex items-center justify-center"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {notifications.map((req, i) => (
                  <div key={i} className="flex items-center min-w-0 justify-between gap-2 p-2 border-b border-hairline dark:border-dhairline last:border-none">
                    {req.sender.profilePic ? (
                      <img src={req.sender.profilePic} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-lightMain2 dark:bg-[#393939] flex justify-center items-center shrink-0">
                        <User size={14} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-txt dark:text-white font-medium truncate">{req.sender.name} sent follow request</p>
                      <p className="text-[11px] text-txt2 dark:text-[#8a8a8a]">{formatDate(req.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleFollowConfirm(req.sender._id, req._id)} className="px-2 py-1 text-xs bg-gradient-main text-white rounded-md">
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeleteNotif(req._id)}
                        aria-label={`Dismiss follow request from ${req.sender.name}`}
                        className="p-1 text-xs bg-lightMain2 dark:bg-dlightMain text-txt dark:text-white rounded-md flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {RAIL_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center w-[52px] h-[52px] rounded-xl gap-[3px] transition-colors
             focus-visible:ring-2 focus-visible:ring-accentMain focus-visible:ring-offset-2 focus-visible:ring-offset-main dark:focus-visible:ring-offset-[#111]
             ${isActive ? 'bg-lightMain dark:bg-[#1e1e1e] text-txt dark:text-white' : 'text-txt2 dark:text-[#8a8a8a] hover:text-txt dark:hover:text-white'}`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-[-12px] top-[14px] bottom-[14px] w-[3px] rounded-[0_3px_3px_0] bg-gradient-main"
                />
              )}
              <Icon size={21} strokeWidth={1.8} />
              <span className={`text-[9.5px] leading-none ${isActive ? 'font-semibold' : ''}`}>{label}</span>
            </>
          )}
        </NavLink>
      ))}

      <div className="mt-auto flex flex-col items-center gap-[6px]">
        {BOTTOM_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center w-[52px] h-[52px] rounded-xl gap-[3px] transition-colors
               focus-visible:ring-2 focus-visible:ring-accentMain focus-visible:ring-offset-2 focus-visible:ring-offset-main dark:focus-visible:ring-offset-[#111]
               ${isActive ? 'bg-lightMain dark:bg-[#1e1e1e] text-txt dark:text-white' : 'text-txt2 dark:text-[#8a8a8a] hover:text-txt dark:hover:text-white'}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[-12px] top-[14px] bottom-[14px] w-[3px] rounded-[0_3px_3px_0] bg-gradient-main"
                  />
                )}
                <Icon size={21} strokeWidth={1.8} />
                <span className={`text-[9.5px] leading-none ${isActive ? 'font-semibold' : ''}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Settings gear — holds the privacy / co-presence / home-location / theme / logout
            controls that used to sit in Navbar's dropdown. Same accessible-switch pattern
            preserved verbatim. */}
        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            aria-label="Settings"
            aria-expanded={showSettings}
            aria-haspopup="true"
            className="flex flex-col items-center justify-center w-[52px] h-[52px] rounded-xl gap-[3px] text-txt2 dark:text-[#8a8a8a] hover:text-txt dark:hover:text-white transition-colors
                       focus-visible:ring-2 focus-visible:ring-accentMain focus-visible:ring-offset-2 focus-visible:ring-offset-main dark:focus-visible:ring-offset-[#111]"
          >
            <Settings size={21} strokeWidth={1.8} />
            <span className="text-[9.5px] leading-none">Settings</span>
          </button>

          {showSettings && (
            <div className="absolute left-[64px] bottom-0 w-[240px] bg-main/95 dark:bg-[#161616]/95 backdrop-blur-md border border-hairline dark:border-dhairline shadow-2xl rounded-xl p-2 z-50">
              <div className="px-3 py-2 mb-2 border-b border-hairline dark:border-dhairline">
                <p className="text-[11px] font-semibold text-txt2 dark:text-[#8a8a8a] uppercase tracking-wider">Account</p>
                <p className="text-sm font-medium text-txt dark:text-white truncate">{name}</p>
                <p className="text-[11.5px] text-txt2 dark:text-[#a0a0a0] truncate">{email}</p>
              </div>

              <button
                type="button"
                onClick={handlePrivacyToggle}
                role="switch"
                aria-checked={isPrivate}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-lightMain dark:hover:bg-white/5 transition mb-1"
              >
                <span className="flex items-center gap-2 text-txt dark:text-white">
                  {isPrivate ? <Lock size={16} className="text-red-500" /> : <Globe size={16} className="text-green-500" />}
                  <span className="text-sm">{isPrivate ? 'Private Account' : 'Public Account'}</span>
                </span>
                <span className={`block w-8 h-4 rounded-full relative transition-colors ${isPrivate ? 'bg-red-500' : 'bg-lightMain2 dark:bg-gray-600'}`}>
                  <span className={`block absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isPrivate ? 'right-0.5' : 'left-0.5'}`} />
                </span>
              </button>

              <button
                type="button"
                onClick={handleCoPresenceToggle}
                role="switch"
                aria-checked={coPresenceOptIn}
                title="When enabled, Echoes may suggest people you follow each other with who were near the same place at the same time as you, using your memories' location, timing, and photos. A suggestion is only ever shown after both people confirm it."
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-lightMain dark:hover:bg-white/5 transition mb-1"
              >
                <span className="flex items-center gap-2 text-txt dark:text-white">
                  <Users size={16} className={coPresenceOptIn ? 'text-accentMain' : 'text-gray-500'} />
                  <span className="text-sm">Co-presence suggestions</span>
                </span>
                <span className={`block w-8 h-4 rounded-full relative transition-colors ${coPresenceOptIn ? 'bg-accentMain' : 'bg-lightMain2 dark:bg-gray-600'}`}>
                  <span className={`block absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${coPresenceOptIn ? 'right-0.5' : 'left-0.5'}`} />
                </span>
              </button>

              <button onClick={handlehomeLocation} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-lightMain dark:hover:bg-white/5 text-txt dark:text-white transition mb-1">
                <MapPinHouse size={16} />
                <span className="text-sm">Home Location</span>
              </button>

              <button onClick={() => setDark((prev) => !prev)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-lightMain dark:hover:bg-white/5 text-txt dark:text-white transition mb-1">
                {dark ? <SunMedium size={16} /> : <MoonStar size={16} />}
                <span className="text-sm">{dark ? 'Light Mode' : 'Dark Mode'}</span>
              </button>

              <button onClick={logOutUser} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-500 transition mt-2 border-t border-hairline dark:border-dhairline pt-3">
                <LogOut size={16} />
                <span className="text-sm font-medium">Log Out</span>
              </button>
            </div>
          )}
        </div>

        <NavLink
          to="/profile"
          aria-label="Your profile"
          className={({ isActive }) =>
            `mt-[2px] w-[34px] h-[34px] rounded-full overflow-hidden focus-visible:ring-2 focus-visible:ring-accentMain focus-visible:ring-offset-2 focus-visible:ring-offset-main dark:focus-visible:ring-offset-[#111]
             ${isActive || isProfileActive ? 'ring-2 ring-txt dark:ring-white' : 'border border-lightMain2 dark:border-[#2b2b2b]'}`
          }
        >
          {profilePic ? (
            <img src={profilePic} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full bg-lightMain2 dark:bg-[#393939] flex items-center justify-center">
              <User size={16} className="text-gray-400" />
            </span>
          )}
        </NavLink>
      </div>
    </nav>
  );
};

export default Rail;
