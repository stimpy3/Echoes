import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronLeft, Lock, User } from "lucide-react";
import axios from "axios";
import TimelineMapView from "../components/Map/TimelineMapView";
import Rail from "../components/Layout/Rail";
import { FilterRow } from "../components/Layout/ContentHeader";
import MemoryCard from "../components/Memories/MemoryCard";
import PostModal from "../components/Memories/PostModal";
import BareHomePage from './BarebonesPages/BareProfilePage';
import Lottie from "lottie-react";
import animationData from "../data/animationData/emptyAnimation.json";

const ProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

  const [activeTab, setActiveTab] = useState("posts");
  const [user, setUser] = useState(null);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followState, setFollowState] = useState("none");
  const [currentUserId, setCurrentUserId] = useState("");
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);
  const [showUnfollowModal, setShowUnfollowModal] = useState(false);

  const handleFollow = async () => {
    if (followState === "following") {
      setShowUnfollowModal(true);
      return;
    }
    try {
      const res = await axios.post(`${BASE_URL}/api/follow/request`, { receiverId: id }, { withCredentials: true });
      if (res.data.following) setFollowState("following");
      else if (res.data.requested) setFollowState("requested");
      else setFollowState("none");
    } catch (err) {
      console.error("Follow error:", err);
    }
  };

  const handleUnfollow = async () => {
    try {
      await axios.post(`${BASE_URL}/api/follow/unfollow`, { receiverId: id }, { withCredentials: true });
      setFollowState("none");
      setShowUnfollowModal(false);
    } catch (err) {
      console.error("Unfollow error:", err);
    }
  };

  useEffect(() => {
    const fetchFollowState = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/users/status/${id}`, { withCredentials: true });
        if (res.data.following) setFollowState("following");
        else if (res.data.requested) setFollowState("requested");
        else setFollowState("none");
      } catch (err) {
        console.error("Error fetching follow status:", err);
      }
    };
    fetchFollowState();
  }, [id]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/users/${id}`, { withCredentials: true });
        setUser(res.data);
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    };
    fetchUser();
  }, [id]);

  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/memory/user/${id}`, {
          withCredentials: true,
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        setMemories(res.data.memories || []);
      } catch (err) {
        console.error("Error fetching memories:", err);
        setMemories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMemories();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const fetchFollowCounts = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/users/${id}/follow-counts`, { withCredentials: true });
        setFollowersCount(res.data.followerCount);
        setFollowingCount(res.data.followingCount);
      } catch (err) {
        console.error("Error fetching follow counts:", err);
      }
    };
    fetchFollowCounts();
  }, [id]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/user/navbar`, { withCredentials: true });
        setCurrentUserId(res.data._id);
      } catch (err) {
        console.error("Error fetching current user:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  if (!user || loading) {
    return (
      <div className="w-full min-h-screen flex bg-main dark:bg-dmain">
        <Rail />
        <div className="flex-1 min-w-0">
          <BareHomePage />
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUserId && id && currentUserId === id;
  const canViewPrivateContent = isOwnProfile || !user?.isPrivate || followState === "following";

  const handleOpenChat = async () => {
    navigate("/chat", { state: { id: user._id, name: user.name, profilePic: user.profilePic } });
  };

  return (
    <div className="w-full min-h-screen flex bg-main dark:bg-dmain">
      <Rail />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[72px] flex items-center gap-4 px-8 border-b border-hairline dark:border-dhairline">
          <button onClick={() => navigate(-1)} aria-label="Back" className="text-txt dark:text-dtxt">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[22px] font-bold tracking-[-0.01em] text-txt dark:text-dtxt truncate">{user.name}</h1>
          <span className="ml-auto px-[9px] py-[3px] rounded-full bg-slightLightMain dark:bg-[#1c1c1c] text-[11px] font-semibold uppercase tracking-[.06em] text-[#5a5a5a]">
            {user.isPrivate ? 'Private' : 'Public'}
          </span>
        </header>

        {/* Identity block */}
        <div className="p-8 border-b border-hairline dark:border-dhairline flex items-start gap-8">
          {user.profilePic ? (
            <img src={user.profilePic} alt="" className="w-[112px] h-[112px] rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-[112px] h-[112px] rounded-full bg-lightMain dark:bg-dlightMain flex items-center justify-center shrink-0">
              <User size={48} className="text-gray-400" />
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <h2 className="text-[17px] font-semibold text-txt dark:text-dtxt truncate">{user.name}</h2>
            <p className="text-[12.5px] text-txt2 dark:text-dtxt2 truncate">{user.email}</p>
            <div className="flex gap-10 mt-4">
              {[
                { value: memories.length, label: 'echoes' },
                { value: followersCount, label: 'followers' },
                { value: followingCount, label: 'following' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col gap-1">
                  <span className="font-black leading-none text-txt dark:text-dtxt" style={{ fontFamily: '"Archivo Black", sans-serif', fontSize: 26 }}>
                    {stat.value}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-txt2 dark:text-dtxt2">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {!isOwnProfile && (
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                onClick={handleFollow}
                className={`h-[38px] px-[22px] rounded-full text-[13px] font-semibold ${
                  followState === "none"
                    ? "bg-gradient-mainBright text-white"
                    : "border border-lightMain2 dark:border-dlightMain2 text-txt dark:text-dtxt"
                }`}
              >
                {followState === "following" ? "Following" : followState === "requested" ? "Requested" : "Follow"}
              </button>
              <button
                onClick={handleOpenChat}
                className="h-[38px] px-[22px] rounded-full border border-lightMain2 dark:border-dlightMain2 text-[13px] font-medium text-txt dark:text-dtxt"
              >
                Message
              </button>
            </div>
          )}
        </div>

        <FilterRow
          options={[{ value: 'posts', label: 'Posts' }, { value: 'map', label: 'Map' }]}
          value={activeTab}
          onChange={setActiveTab}
        />

        {!canViewPrivateContent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
            <div className="w-14 h-14 rounded-full bg-lightMain dark:bg-dlightMain flex items-center justify-center mb-4">
              <Lock size={26} className="text-txt dark:text-dtxt" />
            </div>
            <p className="text-lg font-semibold text-txt dark:text-dtxt">This account is private</p>
            <p className="text-sm text-txt2 dark:text-dtxt2 mt-2 max-w-md">
              Follow this user to view their posts and map memories.
            </p>
          </div>
        ) : activeTab === "posts" ? (
          memories.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <Lottie animationData={animationData} loop={true} className="h-[250px]" />
              <p className="text-txt dark:text-dtxt text-lg mb-4">No memories yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-8">
              {memories.map((memory) => (
                <MemoryCard key={memory._id} memory={memory} currentUserId={currentUserId} />
              ))}
            </div>
          )
        ) : (
          <div className="flex-1 relative">
            <TimelineMapView memories={memories} onPinClick={(id) => setSelectedMemoryId(id)} />
          </div>
        )}
      </div>

      {selectedMemoryId && canViewPrivateContent && (
        <PostModal memoryId={selectedMemoryId} currentUserId={currentUserId} onClose={() => setSelectedMemoryId(null)} />
      )}

      {showUnfollowModal && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40" onClick={() => setShowUnfollowModal(false)}></div>
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-lightMain dark:bg-dlightMain p-3 rounded-lg w-[90%] max-w-sm shadow-lg">
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white m-4">
              Unfollow <span className="text-transparent bg-clip-text font-bold bg-gradient-main">{user.name}?</span>
            </h3>
            <p className="text-sm text-center text-txt2 dark:text-dtxt2 mb-6">Are you sure you want to unfollow this user?</p>
            <div className="flex justify-between gap-4 font-semibold">
              <button onClick={() => setShowUnfollowModal(false)} className="flex-1 py-2 rounded-md border-[2px] bg-main text-txt text-center">
                Cancel
              </button>
              <button onClick={handleUnfollow} className="flex-1 py-2 rounded-md bg-black text-white text-center">
                Unfollow
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProfilePage;
