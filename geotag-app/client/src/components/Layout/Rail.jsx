import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  MoonStar, SunMedium, LogOut, Settings, ChartNoAxesColumn, MapPinHouse,
  MessageCircle, Globe, Lock, Users, X, Map as MapIcon, Search, Clock, BarChart3, User,
} from 'lucide-react';

import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';
import { socket } from '../../utils/socket';
import { clearCsrfToken } from '../../utils/csrf';

/*
Desktop chrome only — replaces the floating pill nav, the gear dropdown and the map's
separate control stack with one 76px rail. Mobile keeps its own top bar / tab bar
(designed separately); this component renders nothing below the md breakpoint.
*/
const RAIL_ITEMS = [
  { to: '/home', label: 'Map', icon: MapIcon },
  { to: '/explore', label: 'Explore', icon: Search },
  { to: '/timeline', label: 'Time', icon: Clock },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
];

const BOTTOM_ITEMS = [
  { to: '/analytics', label: 'Stats', icon: BarChart3 },
  { to: '/copresence', label: 'Together', icon: Users },
];

const Rail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { dark, setDark } = useTheme();

  const [showSettings, setShowSettings] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [coPresenceOptIn, setCoPresenceOptIn] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  const settingsRef = useRef(null);
  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';

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
    const fetchNotifCount = async () => {
      try {
        const [notifRes, pendingRes] = await Promise.all([
          axios.get(`${BASE_URL}/api/follow/notifications`, { withCredentials: true }),
          axios.get(`${BASE_URL}/api/copresence/pending`, { withCredentials: true }),
        ]);
        setNotifCount((notifRes.data?.length || 0) + (pendingRes.data?.length || 0));
      } catch (err) {
        console.log('Notif count fetch error:', err);
      }
    };
    fetchNotifCount();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setShowSettings(false);
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
              {to === '/chat' && notifCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-[8px] right-[10px] w-[7px] h-[7px] rounded-full bg-gradient-main ring-[1.5px] ring-main dark:ring-[#111]"
                />
              )}
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
