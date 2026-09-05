import { useEffect, useState } from "react";
import { MapPin, Users } from "lucide-react";
import axios from "axios";
import Rail from "../components/Layout/Rail";
import ContentHeader from "../components/Layout/ContentHeader";
import { formatDDMMYY } from "../utils/formatDDMMYY";

/*
Co-presence rollout, Phase 5. Reads GET /api/copresence/matches exclusively — a
confirmed match is the only kind of co-presence data this page (or any page) is allowed
to render, per this feature's core rule: nothing is shown to anyone until BOTH people
involved have separately confirmed it. There is deliberately no "pending suggestions"
list on this page — those live in the rail's notification tray instead, since a
suggestion nobody has agreed to yet isn't something to browse, it's something to answer.
*/
const CoPresenceMatchesPage = () => {
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
    <div className="w-full min-h-screen flex bg-main dark:bg-dmain">
      <Rail />
      <div className="flex-1 min-w-0 flex flex-col">
        <ContentHeader
          title="Co-presence"
          meta={`${matches.length} confirmed moment${matches.length === 1 ? '' : 's'}`}
          trailing={
            <a href="#" className="text-[12.5px] font-semibold text-accentMain" onClick={(e) => e.preventDefault()}>
              How this works
            </a>
          }
        />

        <div className="grid p-8 gap-6" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gridAutoRows: 'min-content' }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-full h-[280px] rounded-xl bg-lightMain dark:bg-[#191919] animate-pulse" />
            ))
          ) : (
            <>
              {matches.map((m) => (
                <div
                  key={m._id}
                  className="rounded-xl border border-hairline dark:border-dhairline overflow-hidden"
                >
                  <div className="flex items-center px-4 py-[14px] border-b border-hairline dark:border-dhairline">
                    <div className="flex items-center">
                      {m.otherUser?.profilePic ? (
                        <img src={m.otherUser.profilePic} alt="" className="w-[30px] h-[30px] rounded-full object-cover" style={{ border: '2px solid var(--tw-ring-offset-color, transparent)' }} />
                      ) : (
                        <div className="w-[30px] h-[30px] rounded-full bg-gray-400 dark:bg-[#393939] flex items-center justify-center">
                          <Users size={14} className="text-gray-200 dark:text-gray-400" />
                        </div>
                      )}
                      <div className="w-[30px] h-[30px] rounded-full bg-lightMain2 dark:bg-dlightMain2 -ml-[10px] flex items-center justify-center overflow-hidden">
                        <Users size={14} className="text-gray-500" />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-txt dark:text-dtxt ml-2">
                      You &amp; {m.otherUser?.name}
                    </span>
                    <span className="ml-auto text-[11px] font-semibold uppercase tracking-[.1em] text-txt2 dark:text-dtxt2">
                      {formatDDMMYY(m.matchedAt)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2">
                    {[m.myMemory, m.otherMemory].map((mem, idx) => (
                      <div key={idx} className="relative bg-black/10 dark:bg-white/5" style={{ height: 190 }}>
                        {mem?.photoUrl && (
                          <img src={mem.photoUrl} alt={mem.title || ""} className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 px-4 py-3 text-[12.5px]">
                    <MapPin size={13} className="text-txt2 dark:text-dtxt2 shrink-0" />
                    <span className="text-txt dark:text-dtxt truncate">{m.myMemory?.location?.address}</span>
                    <span className="text-txt2 dark:text-dtxt2 shrink-0">· within 40 minutes</span>
                  </div>
                </div>
              ))}

              <div
                className="col-span-2 flex flex-col items-center justify-center text-center py-8 rounded-xl border border-dashed border-lightMain2 dark:border-dlightMain2"
              >
                <div className="w-11 h-11 rounded-full bg-lightMain dark:bg-dlightMain flex items-center justify-center mb-3">
                  <Users size={20} className="text-txt dark:text-dtxt" />
                </div>
                <p className="text-[17px] font-semibold text-txt dark:text-dtxt">That's everything so far</p>
                <p className="text-[13px] leading-[1.6] text-txt2 dark:text-dtxt2 mt-2 max-w-[440px]">
                  When you and someone you follow each other with confirm you were together
                  at the same place and time, it shows up here — both of your photos from that
                  moment, side by side.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoPresenceMatchesPage;
