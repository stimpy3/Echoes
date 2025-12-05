import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronLeft, Map, LayoutGrid } from "lucide-react";
import axios from "axios";
import MapView from "../components/Map/MapView";
import Navbar from "../components/Layout/Navbar";
import MemoryCard from "../components/Memories/MemoryCard";
import BareHomePage from './BarebonesPages/BareProfilePage';
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
  const [followState, setFollowState] = useState("none");
// "none" | "requested" | "following"


  // --- HOOKS ---


  //follow user
// --- inside ProfilePage component ---

const [showUnfollowModal, setShowUnfollowModal] = useState(false);

// Handle Follow button click
const handleFollow = async () => {
  if (followState === "following") {
    // Open modal instead of directly unfollowing
    setShowUnfollowModal(true);
    return;
  }

  try {
    const res = await axios.post(
      `${BASE_URL}/api/follow/request`,
      { receiverId: id },
      { withCredentials: true }
    );

    if (res.data.following) setFollowState("following");
    else if (res.data.requested) setFollowState("requested");
    else setFollowState("none");
  } catch (err) {
    console.error("Follow error:", err);
  }
};

// Handle actual unfollow
const handleUnfollow = async () => {
  try {
    await axios.post(
      `${BASE_URL}/api/follow/unfollow`,
      { receiverId: id },
      { withCredentials: true }
    );
    setFollowState("none");
    setShowUnfollowModal(false);
  } catch (err) {
    console.error("Unfollow error:", err);
  }
};

//fetch follow status
useEffect(() => {
  const fetchFollowState = async () => {
    try {
      const res = await axios.get(
        `${BASE_URL}/api/users/status/${id}`,
        { withCredentials: true }
      );

      if (res.data.following) {
        setFollowState("following");
      } else if (res.data.requested) {
        setFollowState("requested");
      } else {
        setFollowState("none");
      }
    } catch (err) {
      console.error("Error fetching follow status:", err);
    }
  };

  fetchFollowState();
}, [id]);



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
    } catch (err) {
      console.error("Error fetching follow counts:", err);
    }
  };

  fetchFollowCounts();
}, [id]);

  if (!user || loading) {
     return <BareHomePage />;

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
                <section className="w-fit flex gap-4 mt-[10px] ">
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
                    {followState === "following"
                      ? "Following"
                      : followState === "requested"
                      ? "Requested"
                      : "Follow"}
                  </button>
                  <button onClick={()=> navigate("/chat", {
                                        state: {
                                          id: user._id,
                                          name: user.name,
                                          profilePic: user.profilePic
                                        }
                                      })}  
                 className="bg-lightMain dark:bg-dlightMain py-1 px-2 rounded-[5px]">Message</button>
                </section>
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
      {showUnfollowModal && (
  <>
    {/* Background overlay */}
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40"
      onClick={() => setShowUnfollowModal(false)}
    ></div>

    {/* Modal */}
    <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-lightMain dark:bg-dlightMain p-3 rounded-lg w-[90%] max-w-sm shadow-lg">
  <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white m-4">
    Unfollow <span className="text-transparent bg-clip-text font-bold bg-gradient-main">{user.name}?</span>
  </h3>
  <p className="text-sm text-center text-txt2 dark:text-dtxt2 mb-6">
    Are you sure you want to unfollow this user?
  </p>
  <div className="flex justify-between gap-4 font-semibold">
    <button
      onClick={() => setShowUnfollowModal(false)}
      className="flex-1 py-2 rounded-md border-[2px] bg-main text-txt text-center"
    >
      Cancel
    </button>
    <button
      onClick={handleUnfollow}
      className="flex-1 py-2 rounded-md  bg-black text-white text-center"
    >
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
