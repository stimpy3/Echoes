import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { NavLink } from "react-router-dom";
import { MoonStar, SunMedium, LogOut, Settings, ChartNoAxesColumn, MapPinHouse, Bell, MessageCircleMore, Globe, Lock, Menu, X, Users } from 'lucide-react';

import { useTheme } from "../../context/ThemeContext";
import { useHome } from '../../context/HomeContext';
import axios from "axios";
import { useNavigate } from 'react-router-dom';
import { socket } from '../../utils/socket';
import { clearCsrfToken } from '../../utils/csrf';

/*
Single source of truth for the primary nav destinations. These were previously written out
three times for desktop and three more for mobile — six copies of the same routes, each with
its own duplicated class string, so adding a nav item meant editing two places and keeping
two sets of styles in sync by hand. The styling still differs between desktop and mobile
(pill row vs grid), which is fine — that's presentation. Only the data is shared.
*/
const NAV_LINKS = [
  { to: "/home", label: "Map" },
  { to: "/explore", label: "Explore" },
  { to: "/timeline", label: "Timeline" },
];

const Navbar = () => {
  const navigate = useNavigate();
  const { homePosition } = useHome();
  const { dark, setDark } = useTheme();

  const [showSettings, setShowSettings] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  // Co-presence rollout, Phase 1: default false/off, matches the server schema's
  // default.
  const [coPresenceOptIn, setCoPresenceOptIn] = useState(false);
  // Phase 5: pending co-presence suggestions, shown alongside follow-request
  // notifications in the same dropdown. Only ever this user's own candidates — see
  // GET /api/copresence/pending's own scoping.
  const [coPresenceCandidates, setCoPresenceCandidates] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notifCount = notifications.length + coPresenceCandidates.length;

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

  // Phase 5. Confirming here never tells this tab whether the OTHER person has already
  // confirmed — the server's response is only ever "awaiting_other_confirmation" or
  // "matched" from THIS user's own action, which is exactly the property the backend's
  // confirm route was built to guarantee (see server/routes/coPresenceRoutes.js).
  const handleCoPresenceConfirm = async (candidateId) => {
    try {
      await axios.post(`${BASE_URL}/api/copresence/${candidateId}/confirm`, {}, { withCredentials: true });
      setCoPresenceCandidates(prev => prev.filter(c => c._id !== candidateId));
    } catch (err) {
      console.error("Error confirming co-presence suggestion:", err);
    }
  };

  const handleCoPresenceReject = async (candidateId) => {
    try {
      await axios.post(`${BASE_URL}/api/copresence/${candidateId}/reject`, {}, { withCredentials: true });
      setCoPresenceCandidates(prev => prev.filter(c => c._id !== candidateId));
    } catch (err) {
      console.error("Error rejecting co-presence suggestion:", err);
    }
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

    // Escape closing an open dropdown is a baseline expectation for any popover — without
    // it, a keyboard user who opens the settings menu has no way to dismiss it without
    // tabbing through every item or reaching for the mouse.
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setOpenNotif(false);
        setShowSettings(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
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
        setCoPresenceOptIn(Boolean(res.data.coPresenceOptIn));
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

  // Co-presence rollout, Phase 1: saves the flag only. No candidate generation, no
  // matching, no visible effect anywhere else in the app yet — see
  // server/models/coPresenceCandidate.js for what later phases build on top of this.
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
      console.error("Error updating co-presence opt-in:", err);
    }
  };

  const logOutUser = async () => {
    try {
      await axios.post(`${BASE_URL}/api/auth/logout`, {}, { withCredentials: true });
      //The socket's identity was fixed at handshake time from the JWT cookie, so it does not
      //stop being "this user" just because the cookie was cleared. Drop it explicitly, or the
      //next person to log in on this tab would inherit the previous user's live connection.
      socket.disconnect();
      clearCsrfToken(); // stale once the session it was issued for ends; not sensitive on its own, just tidy
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

  // Phase 5. A separate effect/endpoint from follow-request notifications — co-presence
  // suggestions are a different kind of thing with a different backend (see
  // GET /api/copresence/pending), not a variant of the follow-request feed.
  useEffect(() => {
    const fetchCoPresencePending = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/copresence/pending`, { withCredentials: true });
        setCoPresenceCandidates(res.data);
      } catch (err) {
        console.log("Co-presence pending fetch error:", err);
      }
    };
    fetchCoPresencePending();
  }, []);

  return (
    <nav className="bg-[linear-gradient(to_bottom,theme(colors.fadeColor)_10%,transparent_100%)]
          dark:bg-[linear-gradient(to_bottom,theme(colors.dfadeColor)_10%,transparent_100%)] fixed z-[999] top-[0px] py-[5px] left-0 right-0 px-[10px] sm:px-[20px]">
      <div className="flex justify-between items-center h-[50px] relative z-10 gap-2">
        {/* Logo/Brand */}
        <Link to="/home" className="flex items-center space-x-2">
          <div className='bg-[url("/logo.png")] bg-contain bg-no-repeat aspect-[445/549] h-[35px]'></div>
        </Link>

        {/* Navigation Links */}
        {/* Note: the original class string carried BOTH `text-[1.2rem]` and `text-sm`.
            Only one can apply — verified against the built stylesheet that `text-sm` is
            emitted later and therefore wins, making `text-[1.2rem]` dead. Dropped it;
            rendered size is unchanged. */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center space-x-[12px] py-[5px] px-[5px] h-full bg-main/50 dark:bg-dborderColor/50 backdrop-blur-[2px] border-[1px] border-borderColor dark:border-dborderColor rounded-full">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `p-[5px] h-full flex items-center justify-center rounded-full w-[80px] text-center
                 text-sm font-medium ${isActive
                  ? "bg-dmain text-white dark:bg-main dark:text-black"
                  : "text-black dark:text-white"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div className='w-fit h-[50px] flex items-center gap-2 sm:gap-4'>
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setOpenNotif(prev => !prev)}
              // Icon-only button: without a label a screen reader announces just "button".
              // The count goes in the label too, so it isn't information only sighted
              // users get from the badge.
              aria-label={notifCount > 0 ? `Notifications (${notifCount} unread)` : "Notifications"}
              aria-expanded={openNotif}
              aria-haspopup="true"
              className="flex text-borderColor dark:text-dlightTxt items-center justify-center h-full w-full relative"
            >
              <Bell className="scale-[0.9]" />
              {notifCount > 0 && (
                // Capped at 99+ — an uncapped 3-digit count stretches the pill wide enough
                // to overlap the chat icon next to it.
                <span
                  aria-hidden="true"
                  className="absolute top-[-5px] -right-1 bg-red-500 text-white text-[0.65rem] font-semibold px-[6px] py-[1px] rounded-full"
                >
                  {notifCount > 99 ? "99+" : notifCount}
                </span>
              )}
            </button>

            {/* Dropdown Notif */}
            {openNotif && (
              // max-h + overflow-y-auto: the list was previously unbounded, so a user with
              // many pending follow requests got a dropdown taller than the viewport with
              // no way to scroll it — the items past the bottom were unreachable.
              <div className="absolute right-0 top-[48px] w-[min(92vw,360px)] max-h-[min(70vh,420px)] overflow-y-auto custom-scrollbar p-[5px] bg-white dark:bg-dborderColor border border-borderColor dark:border-dborderColor shadow-lg rounded-md backdrop-blur-md">
                {notifications.length === 0 && coPresenceCandidates.length === 0 ? (
                  <p className="text-sm text-txt p-[2px] w-fit dark:text-dtxt whitespace-nowrap">No notifications yet</p>
                ) : (
                  <>
                  {coPresenceCandidates.map((c) => (
                    <div key={c._id} className="flex items-center min-w-0 justify-between gap-2 py-1 border-b border-gray-300 last:border-none">
                      {c.otherUser?.profilePic ? (
                        <img src={c.otherUser.profilePic} alt="pfp" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="aspect-square w-8 h-8 border-[1px] bg-gray-400 dark:bg-[#393939] rounded-full flex justify-center items-center overflow-hidden">
                          <Users size={14} className="text-gray-200 dark:text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8rem] text-txt dark:text-dtxt font-medium truncate">
                          {c.myConfirmed
                            ? `Waiting on ${c.otherUser?.name} to confirm`
                            : `Were you with ${c.otherUser?.name}?`}
                        </p>
                        <p className="text-[0.6rem] text-gray-400">Based on where and when you both posted</p>
                      </div>
                      {!c.myConfirmed && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleCoPresenceConfirm(c._id)}
                            className="px-2 py-1 text-xs bg-gradient-main text-white rounded-md"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => handleCoPresenceReject(c._id)}
                            aria-label={`Not with ${c.otherUser?.name}`}
                            className="p-1 text-xs bg-dlightMain text-white rounded-md flex items-center justify-center"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {notifications.map((req, i) => (
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
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleFollowConfirm(req.sender._id, req._id)}
                          className="px-2 py-1 text-xs bg-gradient-main text-white rounded-md"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleDeleteNotif(req._id)}
                          // Was a literal "X" character — swapped for the same X icon the
                          // rest of the nav uses, and labelled, since "X" alone tells a
                          // screen reader nothing about what it does.
                          aria-label={`Dismiss follow request from ${req.sender.name}`}
                          className="p-1 text-xs bg-dlightMain text-white rounded-md flex items-center justify-center"
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

          <button
            onClick={handleChat}
            aria-label="Messages"
            className="flex text-borderColor dark:text-dlightTxt items-center justify-center"
          >
            <MessageCircleMore />
          </button>

          <div className="hidden md:flex items-center gap-2">

            {/* Settings Button */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettings(prev => !prev)}
                aria-label="Settings"
                aria-expanded={showSettings}
                aria-haspopup="true"
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

                  {/* Privacy Toggle.
                      Was a <div onClick> — not focusable, not reachable by keyboard, and
                      invisible to assistive tech as a control. Now a real <button> with
                      role="switch" + aria-checked, so it announces its on/off state rather
                      than just its label. Inner divs became spans because <div> is flow
                      content and isn't valid inside a <button>. Visuals unchanged. */}
                  <button
                    type="button"
                    onClick={handlePrivacyToggle}
                    role="switch"
                    aria-checked={isPrivate}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition mb-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-txt dark:text-dtxt">
                      {isPrivate ? <Lock size={16} className="text-red-500" /> : <Globe size={16} className="text-green-500" />}
                      <span className="text-sm">{isPrivate ? "Private Account" : "Public Account"}</span>
                    </span>
                    <span className={`block w-8 h-4 rounded-full relative transition-colors ${isPrivate ? "bg-red-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                      <span className={`block absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isPrivate ? "right-0.5" : "left-0.5"}`} />
                    </span>
                  </button>

                  {/* Co-presence opt-in toggle (Phase 1 of the rollout plan). Off by
                      default and does nothing observable yet beyond saving this flag —
                      no matching, no notifications, no one else can see it. Copy states
                      plainly what turning it on will eventually mean, before the toggle,
                      not buried in a help article. Same accessible-switch pattern as the
                      Privacy Toggle above. */}
                  <button
                    type="button"
                    onClick={handleCoPresenceToggle}
                    role="switch"
                    aria-checked={coPresenceOptIn}
                    title="When enabled, Echoes may suggest people you follow each other with who were near the same place at the same time as you, using your memories' location, timing, and photos. A suggestion is only ever shown after both people confirm it."
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition mb-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-txt dark:text-dtxt">
                      <Users size={16} className={coPresenceOptIn ? "text-accentMain" : "text-gray-400"} />
                      <span className="text-sm">Co-presence suggestions</span>
                    </span>
                    <span className={`block w-8 h-4 rounded-full relative transition-colors ${coPresenceOptIn ? "bg-accentMain" : "bg-gray-300 dark:bg-gray-600"}`}>
                      <span className={`block absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${coPresenceOptIn ? "right-0.5" : "left-0.5"}`} />
                    </span>
                  </button>

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

                  {/* Co-presence matches (Phase 5) */}
                  <NavLink to="/copresence" onClick={() => setShowSettings(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-txt dark:text-dtxt transition mb-1">
                    <Users size={16} />
                    <span className="text-sm">Co-presence matches</span>
                  </NavLink>

                  {/* Logout */}
                  <button onClick={logOutUser} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-500 transition mt-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                    <LogOut size={16} />
                    <span className="text-sm font-medium">Log Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* Circle PFP (Clickable to Profile).
                Was a <div onClick> — same problem as the privacy toggle: a mouse-only
                control that keyboard and screen-reader users couldn't reach at all.
                alt="" on the image because the button itself is already labelled; a
                nested "pfp" alt would just make it announce twice. */}
            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label="Your profile"
              className="w-[40px] h-[40px] rounded-full overflow-hidden border-[1px] border-borderColor dark:border-dborderColor cursor-pointer transition active:scale-95"
            >
              {profilePic ? (
                <img src={profilePic} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full bg-gray-400 dark:bg-[#393939] flex items-end justify-center">
                  <i className="fa-solid fa-user text-[1.5rem] text-gray-200 dark:text-gray-400"></i>
                </span>
              )}
            </button>

          </div>

          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-full text-borderColor dark:text-dlightTxt hover:bg-white/10"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden mt-2 rounded-xl border border-borderColor dark:border-dborderColor bg-main/80 dark:bg-dborderColor/80 backdrop-blur-md p-2">
          <div className="grid grid-cols-3 gap-2 mb-2">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-2 py-2 rounded-lg text-center text-sm font-medium ${isActive ? "bg-dmain text-white dark:bg-main dark:text-black" : "text-black dark:text-white bg-white/30 dark:bg-black/20"}`
                }
              >
                {label}
              </NavLink>
            ))}
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
                navigate('/copresence');
              }}
              className="w-full col-span-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/30 dark:bg-black/20 text-txt dark:text-dtxt text-sm"
            >
              Co-presence matches
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