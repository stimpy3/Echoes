import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Rail from '../components/Layout/Rail';
import { MobileTopBar, MobileTabBar } from '../components/Layout/MobileNav';
import { SegmentedPills } from '../components/Layout/ContentHeader';
import GlareHover from '../components/Layout/GlareHover';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import axios from "axios";
import PostModal from '../components/Memories/PostModal';
import TimelineMapView from '../components/Map/TimelineMapView';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PIN_COLORS = [
  { head: 'from-red-500 to-red-800', inner: 'bg-red-900' },
  { head: 'from-blue-500 to-blue-800', inner: 'bg-blue-900' },
  { head: 'from-green-500 to-green-800', inner: 'bg-green-900' },
  { head: 'from-yellow-400 to-yellow-600', inner: 'bg-yellow-700' },
  { head: 'from-purple-500 to-purple-800', inner: 'bg-purple-900' },
  { head: 'from-pink-500 to-pink-800', inner: 'bg-pink-900' },
];
const ROTATIONS = [-0.5, 0, 0.5];

const CURRENT_MONTH_PROMPTS = [
  "This month is still a blank page.",
  "Nothing pinned here yet — go make a memory.",
  "This month's story hasn't started.",
  "Still waiting on this month's first pin.",
  "An empty month, waiting to be filled.",
];

// Deterministic from the memory's own _id, so re-renders don't reshuffle pin colour
// or rotation — Math.random() inside render previously did exactly that.
const hashId = (id) => {
  let hash = 0;
  for (let i = 0; i < String(id).length; i++) hash = String(id).charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
};

const TimelinePage = () => {
  const navigate = useNavigate();
  const { dark } = useTheme();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const currentMonthIndex = new Date().getMonth();
  const [memories, setMemories] = useState([]);
  const carouselRefs = useRef([...Array(12)].map(() => React.createRef()));
  const [currentUserId, setCurrentUserId] = useState("");
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);
  const [viewMode, setViewMode] = useState("list");

  const [hasOverflow, setHasOverflow] = useState(Array(12).fill(false));

  useEffect(() => {
    const overflowStatus = carouselRefs.current.map(ref => {
      const el = ref.current;
      if (!el) return false;
      return el.scrollWidth > el.clientWidth;
    });
    setHasOverflow(overflowStatus);
  }, [memories, selectedYear]);

  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

  const scrollCarousel = (monthIndex, direction) => {
    const carousel = carouselRefs.current[monthIndex].current;
    if (carousel) carousel.scrollBy({ left: direction * 200, behavior: 'smooth' });
  };

  // memoryDate is when it happened; createdAt is merely when it was uploaded. Legacy
  // memories have no memoryDate, so createdAt stands in for them.
  const whenOf = (m) => new Date(m.memoryDate || m.createdAt);

  const memoryYears = Array.from(new Set(memories.map(m => whenOf(m).getFullYear()))).sort((a, b) => a - b);
  const minYear = memoryYears.length > 0 ? Math.min(...memoryYears) : new Date().getFullYear();
  const hasPreviousYear = selectedYear > minYear;
  const isCurrentYearRealTime = selectedYear === new Date().getFullYear();

  const memoriesByMonth = Array.from({ length: 12 }, () => []);
  memories.forEach(memory => {
    const when = whenOf(memory);
    if (when.getFullYear() === selectedYear) {
      memoriesByMonth[when.getMonth()].push(memory);
    }
  });
  const yearTotal = memoriesByMonth.reduce((sum, arr) => sum + arr.length, 0);

  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/memory/fetchmemory`, { withCredentials: true });
        setMemories(res.data.memories || []);
      } catch (err) {
        console.error("Failed to fetch memories:", err);
      }
    };
    fetchMemories();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/user/navbar`, { withCredentials: true });
        setCurrentUserId(res.data._id);
      } catch (err) {
        console.error("Error fetching current user:", err);
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row bg-main dark:bg-dmain">
      <Rail />
      <MobileTopBar />
      <div className="flex-1 min-w-0 flex flex-col pb-[76px] md:pb-0">
        <header className="h-[72px] flex items-center gap-5 px-8 border-b border-hairline dark:border-dhairline">
          <h1 className="text-[22px] font-bold tracking-[-0.01em] text-txt dark:text-dtxt">Diary</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedYear(prev => prev - 1)}
              className={`text-txt2 dark:text-dtxt2 hover:text-txt dark:hover:text-dtxt transition-colors ${!hasPreviousYear ? 'opacity-0 pointer-events-none' : ''}`}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-black leading-none text-txt dark:text-dtxt" style={{ fontFamily: '"Archivo Black", sans-serif', fontSize: 28 }}>
              {selectedYear}
            </span>
            <button
              onClick={() => setSelectedYear(prev => prev + 1)}
              disabled={isCurrentYearRealTime}
              className={`transition-colors ${isCurrentYearRealTime ? 'text-[#3a3a3a] pointer-events-none' : 'text-txt2 dark:text-dtxt2 hover:text-txt dark:hover:text-dtxt'}`}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <span className="text-[12.5px] text-txt2 dark:text-dtxt2">{yearTotal} memories</span>

          <div className="ml-auto flex items-center gap-3">
            <SegmentedPills
              options={[{ value: 'timeline', label: 'Timeline' }, { value: 'trips', label: 'Trips' }]}
              value="timeline"
              onChange={(v) => v === 'trips' && navigate('/trips')}
            />
            <SegmentedPills
              options={[{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }]}
              value={viewMode}
              onChange={setViewMode}
            />
          </div>
        </header>

        {viewMode === "list" ? (
          yearTotal === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 rounded-full bg-lightMain dark:bg-dlightMain flex items-center justify-center mb-4">
                <span className="w-5 h-5 rounded-full bg-gradient-main" />
              </div>
              <p className="text-lg font-semibold text-txt dark:text-dtxt">No memories in {selectedYear}</p>
              <p className="text-sm text-txt2 dark:text-dtxt2 mt-2 max-w-md">
                {hasPreviousYear ? "Try an earlier year, or add" : "Add"} your first memory from the map to start filling in this timeline.
              </p>
            </div>
          ) : (
          <div className="flex-1 px-8 py-7">
            <div className="flex flex-col">
              {Array.from({ length: 12 }, (_, i) => {
                const has = memoriesByMonth[i].length > 0;
                const isCurrent = isCurrentYearRealTime && i === currentMonthIndex;
                const rowPadding = 20;
                const rowHeight = (has ? 196 : 44) + rowPadding * 2;
                const ghostMessage = CURRENT_MONTH_PROMPTS[hashId(`${selectedYear}-${i}`) % CURRENT_MONTH_PROMPTS.length];

                return (
                  <div
                    key={i}
                    className={`flex gap-5 ${isCurrent ? 'bg-slightLightMain dark:bg-[#131313] rounded-lg' : ''}`}
                    style={{
                      height: rowHeight,
                      borderBottom: i < 11 && !isCurrent ? `1px solid ${dark ? '#1c1c1c' : '#e6e4e0'}` : 'none',
                    }}
                  >
                    {/* Month label */}
                    <div
                      className="w-[104px] flex flex-col items-end justify-center text-right shrink-0 pl-2"
                      style={{ paddingTop: rowPadding, paddingBottom: rowPadding }}
                    >
                      {has ? (
                        <>
                          <span className="text-[17px] font-semibold text-txt dark:text-dtxt">{MONTH_NAMES[i]}</span>
                          <span className="text-[11.5px] text-txt2 dark:text-dtxt2">{memoriesByMonth[i].length} memories</span>
                        </>
                      ) : (
                        <span className={`text-[15px] font-medium ${isCurrent ? 'text-txt dark:text-dtxt' : 'text-[#5a5a5a]'}`}>
                          {MONTH_NAMES[i]}
                        </span>
                      )}
                    </div>

                    {/* Spine — the connecting line runs edge-to-edge of the row (through the
                        padding too) so it stays unbroken between months; only the dot is
                        offset to line up with the vertically-centered content. */}
                    <div className="relative w-5 shrink-0">
                      {i < 11 && (
                        <div
                          className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-1 rounded bg-lightMain2 dark:bg-[#2b2b2b]"
                          style={isCurrent ? { background: 'linear-gradient(to bottom, #fc9b41, #d557e3, #3ed8e3)' } : undefined}
                        />
                      )}
                      <div
                        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ top: rowPadding + (has ? 196 : 44) / 2 }}
                      >
                        {isCurrent ? (
                          <div className="w-5 h-5 rounded-full bg-gradient-main flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-main dark:bg-dmain" />
                          </div>
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-lightMain2 dark:bg-[#343434]" />
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div
                      className="relative flex-1 min-w-0 flex items-center"
                      style={{ paddingTop: rowPadding, paddingBottom: rowPadding }}
                    >
                      {!has ? (
                        isCurrent ? (
                          <div className="flex items-center gap-3 pl-1">
                            <div className="relative w-11 h-12 shrink-0">
                              <div className="absolute inset-x-0 top-0 w-11 h-11 rounded-lg border-2 border-dashed border-lightMain2 dark:border-[#3a3a3a]" />
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[9px] aspect-square rotate-45 border-b-2 border-r-2 border-dashed border-lightMain2 dark:border-[#3a3a3a]" />
                            </div>
                            <div>
                              <p className="text-[13px] font-medium text-txt2 dark:text-dtxt2">{ghostMessage}</p>
                              <button
                                type="button"
                                onClick={() => navigate('/home', { state: { startAddMemory: true } })}
                                className="text-[11.5px] text-accentMain font-semibold mt-0.5 hover:underline"
                              >
                                Create a memory for this month →
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[12.5px] text-[#5a5a5a] pl-1">No memories this month</p>
                        )
                      ) : (
                        <>
                          {hasOverflow[i] && (
                            <button
                              className="absolute z-[50] left-0 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center aspect-square w-[30px] bg-dmain dark:bg-main text-dtxt dark:text-txt shadow-md"
                              onClick={() => scrollCarousel(i, -1)}
                            >
                              <ChevronLeft size={16} />
                            </button>
                          )}
                          {hasOverflow[i] && (
                            <button
                              className="absolute z-[50] right-0 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center aspect-square w-[30px] bg-dmain dark:bg-main text-dtxt dark:text-txt shadow-md"
                              onClick={() => scrollCarousel(i, 1)}
                            >
                              <ChevronRight size={16} />
                            </button>
                          )}
                          <section
                            ref={carouselRefs.current[i]}
                            className="w-full h-full flex gap-[14px] overflow-x-auto scrollbar-hide px-1"
                            style={{ scrollBehavior: 'smooth' }}
                          >
                            {memoriesByMonth[i].map((memory) => {
                              const h = hashId(memory._id);
                              const color = PIN_COLORS[h % PIN_COLORS.length];
                              const rotation = ROTATIONS[h % ROTATIONS.length];
                              return (
                                <GlareHover
                                  key={memory._id}
                                  glareOpacity={0.3}
                                  glareAngle={-30}
                                  glareSize={300}
                                  transitionDuration={900}
                                  playOnce={false}
                                  glareColor="#ffffff"
                                >
                                  <article
                                    data-label="image container"
                                    className="relative shrink-0 shadow-polaroid-dark p-2 w-[180px] h-[180px] bg-white overflow-hidden"
                                    style={{ transform: `rotate(${rotation}deg)` }}
                                  >
                                    <div className="absolute z-[10] flex flex-col items-center left-1/2 -translate-x-1/2 top-[5px] pointer-events-none">
                                      <div className={`relative flex items-center justify-center bg-gradient-to-b ${color.head} rounded-full shadow-md w-4 aspect-square`}>
                                        <div className={`${color.inner} w-[7px] aspect-square rounded-full shadow-inner`} />
                                      </div>
                                      <div className="w-[3px] h-1 bg-black/40 rounded-b-full" />
                                    </div>

                                    <img
                                      src={memory.photoUrl}
                                      alt={memory.title}
                                      className="w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      style={{ height: '85%' }}
                                      onClick={() => setSelectedMemoryId(memory._id)}
                                    />
                                  </article>
                                </GlareHover>
                              );
                            })}
                          </section>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )
        ) : (
          <div className="flex-1 relative">
            <TimelineMapView
              memories={memories}
              onPinClick={(id) => setSelectedMemoryId(id)}
            />
          </div>
        )}

        {selectedMemoryId && (
          <PostModal
            memoryId={selectedMemoryId}
            currentUserId={currentUserId}
            onClose={() => setSelectedMemoryId(null)}
          />
        )}
      </div>
      <MobileTabBar />
    </div>
  );
};

export default TimelinePage;
