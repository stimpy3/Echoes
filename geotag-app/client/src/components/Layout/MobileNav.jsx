import { NavLink, useNavigate } from 'react-router-dom';
import { Bell, MessageCircleMore, Map as MapIcon, Search, MessageCircle, User } from 'lucide-react';

/*
Mobile chrome — a 52px top bar and a 76px bottom tab bar, shown below the md
breakpoint where Rail.jsx hides itself. Timeline moves behind the "You" tab on
mobile per the design spec: four tabs is the limit before labels start truncating.
*/
export const MobileTopBar = ({ profilePic }) => {
  const navigate = useNavigate();
  return (
    <header className="md:hidden sticky top-0 z-[999] flex flex-col">
      <div className="h-[3px] w-full bg-gradient-main" />
      <div
        className="h-[52px] flex items-center px-4 border-b border-hairline dark:border-dhairline"
        style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(12px)' }}
      >
        <img src="/logo.png" alt="Echoes" className="h-6 w-auto" />
        <div className="ml-auto flex items-center gap-4">
          <button aria-label="Notifications" className="text-white">
            <Bell size={19} strokeWidth={1.8} />
          </button>
          <button aria-label="Messages" onClick={() => navigate('/chat')} className="text-white">
            <MessageCircleMore size={19} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </header>
  );
};

const TABS = [
  { to: '/home', label: 'Map', icon: MapIcon },
  { to: '/explore', label: 'Explore', icon: Search },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
];

export const MobileTabBar = ({ profilePic }) => (
  <nav
    className="md:hidden fixed bottom-0 left-0 right-0 z-[999] h-[76px] flex items-center justify-around
               bg-main dark:bg-dmain border-t border-hairline dark:border-dhairline"
  >
    {TABS.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        className={({ isActive }) =>
          `flex flex-col items-center gap-[5px] ${isActive ? 'text-txt dark:text-dtxt font-semibold' : 'text-[#8a8a8a] dark:text-[#7a7a7a]'}`
        }
      >
        <Icon size={22} strokeWidth={1.9} />
        <span className="text-[10.5px]">{label}</span>
      </NavLink>
    ))}
    <NavLink
      to="/profile"
      className={({ isActive }) => `flex flex-col items-center gap-[5px] ${isActive ? 'text-txt dark:text-dtxt font-semibold' : 'text-[#8a8a8a] dark:text-[#7a7a7a]'}`}
    >
      {profilePic ? (
        <img src={profilePic} alt="" className="w-[22px] h-[22px] rounded-full object-cover" />
      ) : (
        <div className="w-[22px] h-[22px] rounded-full bg-[#393939] flex items-center justify-center">
          <User size={12} className="text-gray-400" />
        </div>
      )}
      <span className="text-[10.5px]">You</span>
    </NavLink>
  </nav>
);

export const MobileFab = ({ onClick }) => (
  <button
    onClick={onClick}
    aria-label="New memory"
    className="md:hidden fixed z-[999] right-4 bottom-[92px] w-14 h-14 rounded-full bg-gradient-mainBright
               flex items-center justify-center shadow-[0_12px_32px_rgba(0,0,0,.5)]"
  >
    <span className="text-white text-2xl leading-none" style={{ fontWeight: 400 }}>+</span>
  </button>
);
