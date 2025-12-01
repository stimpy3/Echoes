import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronLeft, Map, LayoutGrid } from "lucide-react";
import axios from "axios";
import MapView from "../components/Map/MapView";
import Navbar from "../components/Layout/Navbar";
import MemoryCard from "../components/Memories/MemoryCard";
import Lottie from "lottie-react";
import animationData from "../data/animationData/emptyAnimation.json";

const ProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

  // --- STATE ---
  const [activeTab, setActiveTab] = useState("posts");
  const [user, setUser] = useState(null);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // --- HOOKS ---

  // Fetch user profile
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/users/${id}`, {
          withCredentials: true,
        });
        setUser(res.data);
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    };
    fetchUser();
  }, [id]);

  // Fetch user's memories
  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/memory/user/${id}`, {
          withCredentials: true,
        });
        setMemories(res.data.memories || []);
      } catch (err) {
        console.error("Error fetching memories:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMemories();
  }, [id]);

  // Fetch follow counts
  useEffect(() => {
    if (!id) return; // don't fire API until id exists
    const fetchFollowCounts = async () => {
    try {
      const res = await axios.get( `${BASE_URL}/api/users/${id}/follow-counts`, {
        withCredentials: true,
      });
      setFollowersCount(res.data.followerCount);  // match backend keys
      setFollowingCount(res.data.followingCount);
      console.log("Follow counts fetched:", res.data);
    } catch (err) {
      console.error("Error fetching follow counts:", err);
    }
  };

  fetchFollowCounts();
}, [id]);

  if (!user || loading) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="bg-main dark:bg-dmain w-full min-h-screen h-fit flex flex-col px-[30px] pb-[10px]">
      <div
        className="w-full flex items-center gap-3 mt-[20px] cursor-pointer"
        onClick={() => navigate(-1)}
      >
        <ChevronLeft className="text-txt dark:text-dtxt" size={28} />
        <span className="text-txt dark:text-dtxt text-lg">Back</span>
      </div>

      {/* PAGE CONTENT */}
      <div className="mt-[10px] flex flex-col justify-center items-center bg-main dark:bg-dmain pb-[5px] w-full">
        {/* Header */}
        <div className="w-full overflow-hidden">
          <div className="h-[200px] flex items-center border-b border-borderColor dark:border-dborderColor">
            {/* Profile picture */}
            <div className="min-w-36 flex items-center justify-between">
              {user.profilePic ? (
                <img
                  src={user.profilePic}
                  alt="pfp"
                  className="w-36 h-36 z-[10] border-[5px] border-main dark:border-dmain rounded-full object-cover"
                />
              ) : (
                <div className="z-[10] w-36 h-36 rounded-full border-4 border-main dark:border-dmain overflow-hidden bg-gray-300 flex items-end justify-center">
                  <i className="fa-solid fa-user text-[7rem] text-gray-500"></i>
                </div>
              )}
            </div>

            {/* Name + Email + Stats */}
            <div className="px-[30px] w-full flex flex-col">
              <div className="w-full pb-[30px]">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {user.name.length > 20
                    ? user.name.slice(0, 19) + "..."
                    : user.name}
                </h2>
                <p className="text-txt2 dark:text-dtxt2 text-sm">{user.email}</p>
              </div>

              <div className="w-full flex justify-around text-[1.5rem]">
                <p>
                  {memories.length}{" "}
                  <span className="text-txt2 dark:text-dtxt2">echoes</span>
                </p>
                <p>
                  {followersCount}{" "}
                  <span className="text-txt2 dark:text-dtxt2">followers</span>
                </p>
                <p>
                  {followingCount}{" "}
                  <span className="text-txt2 dark:text-dtxt2">following</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="w-full mt-[20px] flex justify-center">
          <div className="flex gap-[40px] p-2">
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex flex-col items-center pb-2 transition ${
                activeTab === "posts"
                  ? "text-txt dark:text-dtxt border-b-2 border-txt dark:border-dtxt"
                  : "text-txt2 dark:text-dtxt2"
              }`}
            >
              <LayoutGrid size={22} />
              <span className="text-sm">Posts</span>
            </button>

            <button
              onClick={() => setActiveTab("map")}
              className={`flex flex-col items-center pb-2 transition ${
                activeTab === "map"
                  ? "text-txt dark:text-dtxt border-b-2 border-txt dark:border-dtxt"
                  : "text-txt2 dark:text-dtxt2"
              }`}
            >
              <Map size={22} />
              <span className="text-sm">Map</span>
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "posts" ? (
          memories.length === 0 ? (
            <div className="pb-[10px] flex flex-col items-center justify-center text-center w-full min-h-[80vh] rounded-lg">
              <Lottie
                animationData={animationData}
                loop={true}
                className="h-[250px]"
              />
              <p className="text-txt dark:text-dtxt text-lg mb-4">
                No memories yet
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[5px] min-h-[80vh] w-full mt-4">
              {memories.map((memory) => (
                <MemoryCard key={memory._id} memory={memory} />
              ))}
            </div>
          )
        ) : (
          <div className="w-full h-[80vh] mt-2 rounded-xl overflow-hidden relative border border-borderColor dark:border-dborderColor">
            <MapView
              memories={memories}
              homePosition={null}
              addingMode={false}
              onMapClick={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
