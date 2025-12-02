// --- full rewritten MemoriesPage.jsx ---

import { useState, useEffect } from "react";
import MemoryCard from "../components/Memories/MemoryCard";
import AddMemoryForm from "../components/Memories/AddMemoryForm";
import Navbar from "../components/Layout/Navbar";
import { useTheme } from "../context/ThemeContext";
import animationData from "../data/animationData/emptyAnimation.json";
import Lottie from "lottie-react";


import axios from "axios";
import { ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MemoriesPage = () => {
  const navigate = useNavigate();
  const goToProfile = (userId) => navigate(`/profile/${userId}`);

  const { dark } = useTheme();

  const [memories, setMemories] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [addrLoading, setAddrLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [suggestions, setSuggestions] = useState([]);

  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

  // Fetch user 
  useEffect(() => {
    const fetchUser = async () => {

      try {
        const res = await axios.get(`${BASE_URL}/api/user/navbar`, {
          withCredentials: true,
        });
        setId(res.data._id);
        setName(res.data.name);
        setEmail(res.data.email);
        setProfilePic(res.data.profilePic);
      } catch (err) {
        console.error("Error fetching user data:", err.response?.data || err.message);
      }
    };

    fetchUser();
  }, []);

  // Fetch memories
  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/memory/fetchmemory`, {
          withCredentials: true,
        });

        setMemories(res.data.memories || []);
      } catch (err) {
        console.error("Failed to fetch memories:", err);
      }
    };

    fetchMemories();
  }, []);

  // Delete a memory
  const handleDeleteMemory = async (id) => {
    if (!window.confirm("Delete this memory?")) return;

    setMemories((prev) => prev.filter((m) => m._id !== id));

    try {
      await axios.delete(`${BASE_URL}/api/memory/deletememory/${id}`, {
        withCredentials: true,
      });
    } catch (err) {
      console.error("Delete memory failed:", err);
    }
  };

  // Edit memory
  const handleEditMemory = async (updatedMemory) => {
    try {
      const res = await axios.patch(
        `${BASE_URL}/api/memory/editmemory/${updatedMemory._id}`,
        {
          title: updatedMemory.title,
          description: updatedMemory.description,
        },
        { withCredentials: true }
      );

      setMemories((prev) =>
        prev.map((m) => (m._id === updatedMemory._id ? res.data.memory : m))
      );
    } catch (err) {
      console.error("Failed to edit memory:", err);
    }
  };

  // Fetch suggestions — now includes isRequested
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/users/suggestions`, {
          withCredentials: true,
        });

        setSuggestions(res.data); // each object includes isRequested
      } catch (err) {
        console.error("Suggestions error:", err);
      }
    };

    fetchSuggestions();
  }, []);

  // Handle follow request
  //Backend receives sender (from JWT token) + receiver (from button click).
  //Backend either creates a follow request or deletes it if it exists.
  //Backend responds { requested: true/false }
  //You update your local state (requestedList[index]) based on backend response.
  const handleRequest = async (i, receiverId) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/api/follow/request`,
        { receiverId },
        { withCredentials: true }
      );

      // Update only the clicked suggestion
      setSuggestions((prev) => {
        const updated = [...prev];
        updated[i] = {
          ...updated[i],
          isRequested: res.data.requested,
        };
        return updated;
      });
    } catch (err) {
      console.error("Follow request error:", err);
    }
  };

  // Scroll arrow logic
  useEffect(() => {
    const container = document.getElementById("suggestionContainer");
    const leftBtn = document.getElementById("scrollLeft");
    const rightBtn = document.getElementById("scrollRight");

    const updateButtons = () => {
      if (!container) return;

      const isOverflowing =
        container.scrollWidth > container.clientWidth;

      leftBtn.style.opacity = container.scrollLeft > 0 ? "1" : "0";
      rightBtn.style.opacity =
        container.scrollLeft <
        container.scrollWidth - container.clientWidth - 5
          ? "1"
          : "0";

      leftBtn.style.pointerEvents =
        leftBtn.style.opacity === "1" ? "auto" : "none";
      rightBtn.style.pointerEvents =
        rightBtn.style.opacity === "1" ? "auto" : "none";
    };

    container?.addEventListener("scroll", updateButtons);
    window.addEventListener("resize", updateButtons);
    updateButtons();

    return () => {
      container?.removeEventListener("scroll", updateButtons);
      window.removeEventListener("resize", updateButtons);
    };
  }, []);


  //fetch folllow counts
  useEffect(() => {
  const fetchFollowCounts = async () => {
    if (!id) return; // Guard clause - don't run if id is not set yet
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



  return (
    <div className="bg-main dark:bg-dmain w-full min-h-screen flex flex-col px-[30px] pb-[10px]">

      <Navbar />

      {/* Profile Header */}
      <div className="mt-[70px] flex flex-col items-center">
        <div className="w-full pb-[50px]">
          <div className="h-[200px] flex items-center border-b border-borderColor dark:border-dborderColor">

            {/* Profile Pic */}
            <div className="min-w-36 flex items-center justify-between">
              {profilePic ? (
                <img
                  src={profilePic}
                  className="w-36 h-36 rounded-full border-4 border-main dark:border-dmain object-cover"
                />
              ) : (
                <div className="w-36 h-36 rounded-full bg-gray-300 flex items-end justify-center overflow-hidden">
                  <i className="fa-solid fa-user text-[7rem] text-gray-500"></i>
                </div>
              )}
            </div>

            {/* User info */}
            <div className="px-[30px] w-full">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {name}
              </h2>
              <p className="text-sm text-txt2 dark:text-dtxt2">{email}</p>

              <div className="flex justify-around mt-[20px] text-[1.3rem]">
                <p>{memories.length} <span className="text-txt2 dark:text-dtxt2">echoes</span></p>
                <p
                   className="cursor-pointer"
                   onClick={() => navigate(`/followers`)}
                 >
                   {followersCount} <span className="text-txt2 dark:text-dtxt2">followers</span>
                 </p>
                 <p
                   className="cursor-pointer"
                   onClick={() => navigate(`/following`)}
                 >
                   {followingCount} <span className="text-txt2 dark:text-dtxt2">following</span>
                 </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Memory Grid */}
      {memories.length === 0 ? (
        <div className="flex flex-col items-center text-center min-h-[80vh] bg-main dark:bg-dmain">
          <Lottie animationData={animationData} className="h-[250px] bg-main dark:bg-dmain" />
          <p className="text-txt dark:text-dtxt text-lg">No memories yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[5px]">
          {memories.map((memory) => (
            <MemoryCard
              key={memory._id}
              memory={memory}
              onDelete={handleDeleteMemory}
              onEdit={handleEditMemory}
            />
          ))}
        </div>
      )}

      {/* Suggestions Section */}
      <section className="w-full mt-[50px] relative">
        <p className="text-[1.5rem] pt-[20px] border-t border-borderColor dark:border-dborderColor">
          Suggested for you
        </p>

        <div
          id="suggestionContainer"
          className="w-full flex overflow-x-auto scrollbar-hide scroll-smooth h-fit"
        >
          {suggestions.map((user, i) => (
            <div
              key={user._id}
              className="h-[250px] py-[20px] mr-[30px] shadow-lg"
              onClick={() => goToProfile(user._id)}
            >
              <div className="h-full w-[150px] bg-lightMain dark:bg-dslightLightMain rounded-[10px] border overflow-hidden">

                {/* Avatar */}
                <div className="p-[10px] h-[75%] flex flex-col items-center justify-center">
                  <div className="flex items-end justify-center overflow-hidden w-[90px] h-[90px] rounded-full bg-gray-400 dark:bg-[#393939]">
                    {user.profilePic ? (
                      <img src={user.profilePic} className="w-full h-full object-cover" />
                    ) : (
                      <i className="fa-solid fa-user text-[4rem] text-gray-200 dark:text-gray-400 "></i>
                    )}
                  </div>
                  <div className="py-[5px] text-lightTxt dark:text-dlightTxt">{user.name}</div>
                </div>

                {/* Follow button */}
                <div className="p-[10px] flex items-center justify-center h-[25%]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequest(i, user._id);
                    }}
                    className={`w-full p-[6px] rounded-[5px] text-white transition ${
                      user.isRequested ? "bg-lgradient-main  dark:bg-dgradient-main" : "bg-gradient-main"
                    }`}
                  >
                    {user.isRequested ? (
                      <div className="flex justify-center items-center text-txt dark:text-dtxt">
                        Requested
                      </div>
                    ): (
                      <div className="flex justify-center items-center ">
                        <UserPlus /> &nbsp; Follow
                      </div>
                    )}
                  </button>
                </div>

              </div>
            </div>
          ))}
        </div>

        {/* Left Arrow */}
        <button
          id="scrollLeft"
          onClick={() =>
            document
              .getElementById("suggestionContainer")
              .scrollBy({ left: -300, behavior: "smooth" })
          }
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-dlightMain2 dark:bg-main text-white w-10 h-10 rounded-full opacity-0 pointer-events-none flex items-center justify-center"
        >
          <ChevronLeft />
        </button>

        {/* Right Arrow */}
        <button
          id="scrollRight"
          onClick={() =>
            document
              .getElementById("suggestionContainer")
              .scrollBy({ left: 300, behavior: "smooth" })
          }
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-dlightMain2 dark:bg-main text-white w-10 h-10 rounded-full opacity-0 pointer-events-none flex items-center justify-center"
        >
          <ChevronRight />
        </button>
      </section>
    </div>
  );
};

export default MemoriesPage;
