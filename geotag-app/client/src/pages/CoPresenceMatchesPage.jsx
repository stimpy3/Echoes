import { useEffect, useState } from "react";
import { ChevronLeft, MapPin, Users } from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Layout/Navbar";
import { formatDDMMYY } from "../utils/formatDDMMYY";

/*
Co-presence rollout, Phase 5. Reads GET /api/copresence/matches exclusively — a
confirmed match is the only kind of co-presence data this page (or any page) is allowed
to render, per this feature's core rule: nothing is shown to anyone until BOTH people
involved have separately confirmed it. There is deliberately no "pending suggestions"
list on this page — those live in the Navbar notification dropdown instead, since a
suggestion nobody has agreed to yet isn't something to browse, it's something to answer.
*/
const CoPresenceMatchesPage = () => {
  const navigate = useNavigate();
  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/copresence/matches`, { withCredentials: true });
        setMatches(res.data || []);
      } catch (err) {
        console.error("Error fetching co-presence matches:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  return (
    <div className="bg-main dark:bg-dmain w-full min-h-screen flex flex-col px-[20px] pb-[10px]">
      <Navbar />

      <div className="mt-[70px] w-full flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-txt dark:text-dtxt">
          <ChevronLeft size={22} />
          <span>Back</span>
        </button>
      </div>

      <div className="w-full flex items-center gap-2 mb-6">
        <Users className="text-accentMain" size={22} />
        <h1 className="text-xl font-bold text-txt dark:text-dtxt">Co-presence matches</h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-full h-[140px] rounded-xl bg-gray-300 dark:bg-[#191919] animate-pulse" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="w-full min-h-[50vh] flex flex-col items-center justify-center text-center px-6">
          <Users size={40} className="text-txt2 dark:text-dtxt2 mb-4" />
          <p className="text-lg font-semibold text-txt dark:text-dtxt">No matches yet</p>
          <p className="text-sm text-txt2 dark:text-dtxt2 mt-2 max-w-md">
            When you and someone you follow each other with confirm you were together
            at the same place and time, it shows up here — both of your photos from that
            moment, side by side.
          </p>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-4 pb-10">
          {matches.map((m) => (
            <div
              key={m._id}
              className="w-full rounded-xl border border-borderColor dark:border-dborderColor bg-lightMain dark:bg-dlightMain overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-borderColor dark:border-dborderColor">
                {m.otherUser?.profilePic ? (
                  <img src={m.otherUser.profilePic} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-400 dark:bg-[#393939] flex items-center justify-center">
                    <Users size={14} className="text-gray-200 dark:text-gray-400" />
                  </div>
                )}
                <span className="text-sm font-semibold text-txt dark:text-dtxt">
                  You &amp; {m.otherUser?.name}
                </span>
                <span className="ml-auto text-xs text-txt2 dark:text-dtxt2">
                  {formatDDMMYY(m.matchedAt)}
                </span>
              </div>

              <div className="grid grid-cols-2">
                {[m.myMemory, m.otherMemory].map((mem, idx) => (
                  <div key={idx} className="relative aspect-square bg-black/10 dark:bg-white/5">
                    {mem?.photoUrl && (
                      <img src={mem.photoUrl} alt={mem.title || ""} className="w-full h-full object-cover" />
                    )}
                    {mem?.location?.address && (
                      <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[0.65rem] px-2 py-1 flex items-center gap-1">
                        <MapPin size={10} className="shrink-0" />
                        <span className="truncate">{mem.location.address}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoPresenceMatchesPage;
