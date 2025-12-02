import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import BareBonesFollowListPage from "./BarebonesPages/BareBonesFollowListPage"; 

const FollowerListPage = () => {
  const navigate = useNavigate();
  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowers = async () => {
      setLoading(true); // start loading
      try {
        const res = await axios.get(`${BASE_URL}/api/users/followers`, {
          withCredentials: true,
        });
        setFollowers(res.data || []);
      } catch (err) {
        console.error("Error fetching followers list:", err);
      } finally {
        setLoading(false); // stop loading
      }
    };

    fetchFollowers();
  }, []);

  return (
    <div className="bg-main dark:bg-dmain w-full min-h-screen flex flex-col px-5 pb-5">
      {/* Header */}
      <div className="w-full flex relative items-center gap-3 mt-5 mb-3 border-b border-borderColor dark:border-dborderColor pb-2">
        <div className="absolute flex cursor-pointer" onClick={() => navigate(-1)}>
          <ChevronLeft className="text-txt dark:text-dtxt" size={28} />
          <span className="text-txt dark:text-dtxt text-lg">Back</span>
        </div>
        <h1 className="text-xl font-bold text-txt dark:text-dtxt w-full flex justify-center items-center">
          Followers
        </h1>
      </div>

      {/* List */}
      <div className="w-full flex flex-col gap-4">
        {loading ? (
          <BareBonesFollowListPage /> // show skeleton while loading
        ) : followers.length === 0 ? (
          <p className="text-txt2 dark:text-dtxt2 text-center">No followers yet</p>
        ) : (
          followers.map((user) => (
            <div
              key={user._id}
              className="w-full flex items-center gap-4 p-3 bg-lightMain dark:bg-dslightLightMain rounded-lg cursor-pointer"
              onClick={() => navigate(`/profile/${user._id}`)}
            >
              {user.profilePic ? (
                <img
                  src={user.profilePic}
                  className="w-10 h-10 rounded-full border-4 border-main dark:border-dmain object-cover"
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

export default FollowerListPage;