import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

const ProfilePage = () => {
  const { id } = useParams(); // fetch userId from URL
  const [user, setUser] = useState(null);
  const BASE_URL=import.meta.env.VITE_BASE_URL || "http://localhost:5000";
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/users/${id}`, {
        withCredentials: true, // important! so cookies (token) are sent
        });
        setUser(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUser();
  }, [id]);

  if (!user) return <p>Loading...</p>;//to-add bare bones profile page

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{user.name}</h1>
      {user.profilePic && <img src={user.profilePic} alt={user.name} />}
      <p>{user.email}</p>
      {/* Add memories, followers, following, etc. */}
    </div>
  );
};

export default ProfilePage;
