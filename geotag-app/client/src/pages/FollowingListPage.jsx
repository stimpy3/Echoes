import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import BareBonesFollowListPage from "./BarebonesPages/BareBonesFollowListPage";

const FollowingListPage = () => {
  const navigate = useNavigate();
  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowing = async () => {
      setLoading(true); // start loading
      try {
        const res = await axios.get(`${BASE_URL}/api/users/following`, {
          withCredentials: true,
        });
        setFollowing(res.data || []);
      } catch (err) {
        console.error("Error fetching following list:", err);
      } finally {
        setLoading(false); // stop loading
      }
    };

    fetchFollowing();
  }, []);

  return (
    <div className="bg-main dark:bg-dmain w-full min-h-screen flex flex-col px-[20px] pb-[10px]">
      {/* Header */}
      <div className="w-full flex relative items-center gap-3 mt-[20px] mb-[10px] border-b-[1px] border-borderColor dark:border-dborderColor pb-2">
        <div className="absolute flex cursor-pointer" onClick={() => navigate(-1)}>
          <ChevronLeft className="text-txt dark:text-dtxt" size={28} />
          <span className="text-txt dark:text-dtxt text-lg">Back</span>
        </div>
        <h1 className="text-xl font-bold  w-full flex justify-center items-center">
          <span className="text-transparent bg-clip-text bg-gradient-main ">Following</span>
        </h1>
      </div>

      {/* List */}
      <div className="w-full flex flex-col gap-4">
        {loading ? ( // show skeleton while loading
          <BareBonesFollowListPage />
        ) : following.length === 0 ? (
          <p className="text-txt2 dark:text-dtxt2 text-center">Not following anyone yet</p>
        ) : (
          following.map((user) => (
            <div
              key={user._id}
              className="w-full flex items-center gap-4 p-3 bg-lightMain dark:bg-dslightLightMain rounded-lg cursor-pointer"
              onClick={() => navigate(`/profile/${user._id}`)}
            >
              {user.profilePic ? (
                <img
                  src={user.profilePic}
                  className="w-10 h-10 rounded-full border-4 border-main dark:border-dmain object-cover"
                  alt={user.name}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-300 flex items-end justify-center overflow-hidden">
                  <i className="fa-solid fa-user text-[2rem] text-gray-500"></i>
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-txt dark:text-dtxt font-semibold">{user.name}</span>
                <span className="text-txt2 dark:text-dtxt2 text-sm">{user.email}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FollowingListPage;