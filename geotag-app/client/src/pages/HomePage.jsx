import { Layers2, X, Plus, Search, User, Locate } from "lucide-react";
import React, { useState, useEffect } from "react";
import MapView from "../components/Map/MapView";

import Rail from "../components/Layout/Rail";
import { MobileTopBar, MobileTabBar, MobileFab } from "../components/Layout/MobileNav";
import { useHome } from "../context/HomeContext";
import { useTheme } from "../context/ThemeContext";
import AddMemoryForm from "../components/Memories/AddMemoryForm";
import { useNavigate, useLocation } from 'react-router-dom';

import axios from "axios";

const HomePage = () => {
  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";
  const { homePosition, loading } = useHome();
  const { dark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [addingMode, setAddingMode] = useState(!!location.state?.startAddMemory);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [followList, setFollowList] = useState(false);
  const [followSearch, setFollowSearch] = useState("");
  const [memories, setMemories] = useState([]);
  const [friendMemories, setFriendMemories] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activePinPeople, setActivePinPeople] = useState([]);
  const [applyLoading, setApplyLoading] = useState(false);

  const handleMapClick = (latlng) => {
    // Form already open — this is a re-click to relocate the pending pin, not a fresh
    // placement, so keep the panel open and just move it.
    if (showForm) {
      setSelectedPosition(latlng);
      return;
    }
    if (!addingMode) return;
    setSelectedPosition(latlng);
    setShowForm(true);
    setAddingMode(false);
  };

  // Lets the placeholder pin be dragged to the exact spot after the initial click,
  // instead of forcing a re-click on the map — AddMemoryForm re-syncs its lat/lng fields
  // from `selectedPosition` automatically.
  const handlePendingPositionChange = (latlng) => {
    setSelectedPosition(latlng);
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

  // fetch memories on mount
  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/memory/fetchmemory`, { withCredentials: true });
        setMemories(res.data.memories || []);
      } catch (err) {
        console.error("Failed to fetch memories:", err);
      }
    };
    fetchMemories();
  }, []);

  const visibleFollowing = followSearch
    ? following.filter(p => p.name?.toLowerCase().includes(followSearch.toLowerCase()))
    : following;

  return (
    <div className="w-screen h-screen bg-main dark:bg-dmain flex flex-col md:flex-row overflow-hidden">
      {!addingMode && <Rail />}
      {!addingMode && <MobileTopBar />}

      <div className="flex-1 relative overflow-hidden">
        {/* Add mode banner */}
        {addingMode && (
          <div
            className="absolute z-[1001] left-6 top-6 flex items-center gap-2 px-4 py-2 rounded-full text-txt dark:text-white text-sm border border-hairline dark:border-transparent"
            style={{ background: dark ? 'rgba(23,23,23,.92)' : 'rgba(255,255,255,.92)', backdropFilter: 'blur(10px)' }}
          >
            <span className="w-[7px] h-[7px] rounded-full bg-gradient-main" />
            Placing a memory — drag the pin to adjust
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
                  setSelectedPosition({ lat: latitude, lng: longitude });
                  setShowForm(true);
                  setAddingMode(false);
                },
                (err) => {
                  if (err.code === 1) alert("Location access denied. Please enable location permission for this website in your browser settings.");
                  else if (err.code === 2) alert("Location unavailable. Try again in a few seconds.");
                  else alert("Failed to get location. Please try again.");
                },
                { enableHighAccuracy: true, timeout: 10000 }
              );
            }}
            aria-label="Add memory at your current location"
            title="Add memory at your current location"
            className="absolute z-[1001] left-6 top-[76px] w-[44px] h-[44px] rounded-full grid place-content-center text-txt dark:text-white
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentMain focus-visible:ring-offset-2"
            style={{
              background: dark ? 'rgba(23,23,23,.9)' : 'rgba(255,255,255,.9)',
              backdropFilter: 'blur(10px)',
              border: dark ? '1px solid #2b2b2b' : '1px solid #e6e4e0',
            }}
          >
            <Locate size={20} />
          </button>
        )}

        {!loading && (
          <MapView
            friendMemories={friendMemories}
            memories={memories}
            homePosition={homePosition}
            addingMode={addingMode || showForm}
            onMapClick={handleMapClick}
            pendingPosition={showForm ? selectedPosition : null}
            onPendingPositionChange={handlePendingPositionChange}
          />
        )}

        {/* Top-left cluster: friends' pins toggle */}
        {!addingMode && (
          <div className="absolute z-[1000] left-6 top-6 flex items-center gap-[10px]">
            <button
              onClick={() => { toggleFollowingList(); fetchFollowing(); }}
              aria-label="Toggle friends' pins"
              aria-expanded={followList}
              className="flex items-center gap-2 h-[38px] px-[14px] rounded-full text-[12.5px] text-txt dark:text-white
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentMain focus-visible:ring-offset-2"
              style={{
                background: dark ? 'rgba(23,23,23,.9)' : 'rgba(255,255,255,.9)',
                backdropFilter: 'blur(10px)',
                border: dark ? '1px solid #2b2b2b' : '1px solid #e6e4e0',
              }}
            >
              <Layers2 size={16} />
              Friends' pins{following.length > 0 ? ` · ${following.length}` : ''}
            </button>
          </div>
        )}

        {/* Add / Cancel FAB */}
        <button
          onClick={() => {
            setAddingMode((prev) => !prev);
            setSelectedPosition(null);
          }}
          aria-label={addingMode ? "Cancel adding memory" : "Add new memory"}
          aria-pressed={addingMode}
          className={`hidden md:flex absolute z-[1000] right-6 bottom-6 items-center gap-2 h-[48px] px-5 rounded-full text-white text-sm font-semibold
                      transition-all duration-200 active:scale-95 shadow-[0_12px_32px_rgba(0,0,0,.5)]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentMain focus-visible:ring-offset-2
                      ${addingMode ? "bg-red-500" : "bg-gradient-mainBright"}`}
        >
          {addingMode ? <X size={20} /> : <Plus size={20} />}
          {addingMode ? "Cancel" : "New memory"}
        </button>

        {!addingMode && <MobileFab onClick={() => { setAddingMode(true); setSelectedPosition(null); }} />}
        {!addingMode && <MobileTabBar />}

        {/* Friends' pins panel */}
        {followList && (
          <div
            className="absolute z-[1200] left-0 top-0 h-full w-[320px] bg-main dark:bg-[#0e0e0e] border-r border-hairline dark:border-dhairline flex flex-col"
          >
            <div className="h-[3px] w-full bg-gradient-main shrink-0" />
            <div className="px-5 pt-5 pb-4 border-b border-hairline dark:border-dhairline">
              <div className="flex items-center">
                <h2 className="text-[17px] font-semibold text-txt dark:text-white">Friends' pins</h2>
                <button onClick={toggleFollowingList} aria-label="Close" className="ml-auto text-txt2 dark:text-[#8a8a8a] hover:text-txt dark:hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="relative mt-3">
                <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-txt2 dark:text-[#5a5a5a]" />
                <input
                  type="text"
                  value={followSearch}
                  onChange={(e) => setFollowSearch(e.target.value)}
                  placeholder="Search"
                  className="w-full pl-[32px] pr-3 py-2 rounded-full text-[13px] bg-slightLightMain dark:bg-[#161616] text-txt dark:text-white placeholder:text-txt2 dark:placeholder:text-[#5a5a5a] outline-none focus-visible:ring-2 focus-visible:ring-accentMain"
                />
              </div>
              <div className="flex items-center mt-3">
                <span className="text-[12.5px] text-txt2 dark:text-[#8a8a8a]">{activePinPeople.length} of {following.length} selected</span>
                <button
                  onClick={() => setActivePinPeople(following.map(p => p._id))}
                  className="ml-auto text-[12px] font-semibold text-accentMain"
                >
                  Select all
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {following.length === 0 ? (
                <p className="text-center text-[12.5px] text-txt2 dark:text-[#8a8a8a] p-6">Follow people to see their pins</p>
              ) : visibleFollowing.map((people) => {
                const selected = activePinPeople.includes(people._id);
                return (
                  <div
                    key={people._id}
                    className={`h-[60px] px-5 flex items-center gap-3 border-b ${selected ? 'bg-lightMain dark:bg-[#1a1a1a] border-lightMain2 dark:border-[#141414]' : 'border-hairline dark:border-[#1c1c1c]'}`}
                  >
                    <label htmlFor={`chk-${people._id}`} className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center cursor-pointer shrink-0"
                      style={selected ? { background: 'linear-gradient(45deg,#fc9b41,#d557e3,#3ed8e3)' } : { border: dark ? '1.5px solid #3a3a3a' : '1.5px solid #c9c5bd' }}
                    >
                      <input
                        id={`chk-${people._id}`}
                        type="checkbox"
                        className="sr-only"
                        checked={selected}
                        onChange={(e) => {
                          if (e.target.checked) setActivePinPeople(prev => [...prev, people._id]);
                          else setActivePinPeople(prev => prev.filter(id => id !== people._id));
                        }}
                      />
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </label>

                    {people.profilePic ? (
                      <img src={people.profilePic} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-lightMain2 dark:bg-[#3a3a3a] flex items-center justify-center shrink-0">
                        <User size={14} className="text-gray-400" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => navigate(`/profile/${people._id}`)}
                      className="flex flex-col text-left min-w-0"
                    >
                      <span className={`text-[14px] truncate ${selected ? 'font-semibold text-txt dark:text-white' : 'font-medium text-lightTxt dark:text-[#d0d0d0]'}`}>
                        {people.name}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            {following.length > 0 && (
              <div className="shrink-0 p-4 border-t border-hairline dark:border-dhairline flex gap-2">
                <button
                  onClick={() => setActivePinPeople([])}
                  className="flex-1 h-[42px] rounded-full border border-lightMain2 dark:border-[#2b2b2b] text-txt dark:text-white text-[13px] font-medium"
                >
                  Clear
                </button>
                <button
                  onClick={applyFilter}
                  disabled={applyLoading}
                  className="flex-1 h-[42px] rounded-full bg-gradient-mainBright text-white text-[13.5px] font-semibold disabled:opacity-60"
                >
                  {applyLoading ? "Applying..." : `Show ${activePinPeople.length} pins`}
                </button>
              </div>
            )}
          </div>
        )}

        {showForm && selectedPosition && (
          <AddMemoryForm position={selectedPosition} onClose={handleFormClose}
            onAdd={(newMemory) => {
              setMemories(prev => [...prev, newMemory]);
              setShowForm(false);
            }} />
        )}
      </div>
    </div>
  );
};

export default HomePage;
