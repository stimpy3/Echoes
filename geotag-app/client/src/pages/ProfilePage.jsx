import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronLeft, LayoutGrid, Map as MapIcon, Lock, User } from "lucide-react";
import axios from "axios";
import MapView from "../components/Map/MapView";
import Rail from "../components/Layout/Rail";
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
      <div className="flex-1 min-w-0 flex flex-col px-[30px] pb-[10px] overflow-y-auto">

        <div
          className="w-full flex items-center gap-3 mt-[20px] cursor-pointer"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="text-txt dark:text-dtxt" size={28} />
          <span className="text-txt dark:text-dtxt text-lg">Back</span>
        </div>

        {/* Profile Header */}
        <div className="mt-[10px] flex flex-col items-center">
          <div className="w-full pb-[30px]">
            <div className="h-[200px] flex items-center border-b border-borderColor dark:border-dborderColor">

              <div className="min-w-36 flex items-center justify-between">
                {user.profilePic ? (
                  <img
                    src={user.profilePic}
                    className="w-36 h-36 rounded-full border-4 border-main dark:border-dmain object-cover"
                  />
                ) : (
                  <div className="w-36 h-36 rounded-full bg-gray-300 flex items-end justify-center overflow-hidden">
                    <User size={112} className="text-gray-500" />
                  </div>
                )}
              </div>

              <div className="px-[30px] w-full">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {user.name}
                </h2>
                <p className="text-sm text-txt2 dark:text-dtxt2">{user.email}</p>

                {!isOwnProfile && (
                  <section className="w-fit flex gap-4 mt-[10px]">
                    <button
                      onClick={handleFollow}
                      className={
                        `py-1 px-2 rounded-[5px] ` +
                        (followState === "requested"
                          ? "bg-lgradient-main dark:bg-dgradient-main text-txt dark:text-dtxt"
                          : followState === "following"
                          ? "bg-lightMain dark:bg-dlightMain"
                          : "bg-gradient-main text-dtxt")
                      }
                    >
                      {followState === "following" ? "Following" : followState === "requested" ? "Requested" : "Follow"}
                    </button>
                    <button onClick={handleOpenChat} className="bg-lightMain dark:bg-dlightMain py-1 px-2 rounded-[5px]">
                      Message
                    </button>
                  </section>
                )}

                <div className="flex justify-around mt-[20px] text-[1.3rem]">
                  <p>{memories.length} <span className="text-txt2 dark:text-dtxt2">echoes</span></p>
                  <p className="cursor-pointer" onClick={() => navigate(`/followers`)}>
                    {followersCount} <span className="text-txt2 dark:text-dtxt2">followers</span>
                  </p>
                  <p className="cursor-pointer" onClick={() => navigate(`/following`)}>
                    {followingCount} <span className="text-txt2 dark:text-dtxt2">following</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="w-full mt-[10px] flex justify-center">
          <div className="flex gap-[40px] p-2">
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex flex-col items-center pb-2 transition ${
                activeTab === "posts" ? "text-txt dark:text-dtxt border-b-2 border-txt dark:border-dtxt" : "text-txt2 dark:text-dtxt2"
              }`}
            >
              <LayoutGrid size={22} />
              <span className="text-sm">Posts</span>
            </button>

            <button
              onClick={() => setActiveTab("map")}
              className={`flex flex-col items-center pb-2 transition ${
                activeTab === "map" ? "text-txt dark:text-dtxt border-b-2 border-txt dark:border-dtxt" : "text-txt2 dark:text-dtxt2"
              }`}
            >
              <MapIcon size={22} />
              <span className="text-sm">Map</span>
            </button>
          </div>
        </div>

        {!canViewPrivateContent ? (
          <div className="w-full min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
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
            <div className="flex flex-col items-center text-center min-h-[60vh]">
              <Lottie animationData={animationData} loop={true} className="h-[250px]" />
              <p className="text-txt dark:text-dtxt text-lg">No memories yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[5px] mt-4">
              {memories.map((memory) => (
                <MemoryCard key={memory._id} memory={memory} currentUserId={currentUserId} />
              ))}
            </div>
          )
        ) : (
          <div className="w-full h-[75vh] mt-4 rounded-xl overflow-hidden relative border border-hairline dark:border-dhairline">
            <MapView memories={memories} showHomeMarker={false} />
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
