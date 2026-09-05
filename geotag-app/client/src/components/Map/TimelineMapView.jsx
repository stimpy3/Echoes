import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import CustomMarker from "./CustomMarker";



const TimelineMapView = ({ memories, onPinClick }) => {
  const { dark } = useTheme();

  // See MapView.jsx — CARTO's free basemap CDN now requires an account, so this uses OSM
  // tiles with a CSS invert filter for dark mode instead.
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  // Sort memories by date ascending
  const sortedMemories = useMemo(() => {
    return [...memories]
      .filter(m => m.location && m.location.coordinates && m.location.coordinates.length === 2)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [memories]);

  // Derive time bounds
  const now = new Date();
  const startDate = sortedMemories.length > 0 ? new Date(sortedMemories[0].createdAt) : now;
  const startYear = startDate.getFullYear();
  const startMonth = 0;

  const endYear = now.getFullYear();
  const endMonth = 11;

  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
  const maxMonthTicks = Math.max(0, totalMonths);
  const currentMonthTick = (endYear - startYear) * 12 + now.getMonth();

  const [currentTick, setCurrentTick] = useState(0);
  const rulerViewportRef = useRef(null);
  const tickWidth = 24;
  const scrollFrameRef = useRef(null);
  const initializedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);

  const scrollToTick = useCallback((tickIndex, behavior = "smooth") => {
    const viewport = rulerViewportRef.current;
    if (!viewport) return;

    const clamped = Math.max(0, Math.min(maxMonthTicks, tickIndex));
    const targetLeft = clamped * tickWidth;

    viewport.scrollTo({
      left: Math.max(0, targetLeft),
      behavior,
    });
  }, [maxMonthTicks]);

  // Initialize the ruler once at the real current month and keep existing selection afterward.
  useEffect(() => {
    const clampedCurrent = Math.max(0, Math.min(maxMonthTicks, currentMonthTick));

    if (!initializedRef.current) {
      initializedRef.current = true;
      setCurrentTick(clampedCurrent);
      scrollToTick(clampedCurrent, "auto");
      return;
    }

    setCurrentTick((prev) => Math.max(0, Math.min(maxMonthTicks, prev)));
  }, [maxMonthTicks, currentMonthTick, scrollToTick]);

  // Compute the exact cutoff date based on currentTick
  const currentCutoffDate = useMemo(() => {
    const d = new Date(startYear, startMonth + currentTick + 1, 0, 23, 59, 59, 999);
    return d;
  }, [startYear, startMonth, currentTick]);

  // Derive visible memories up to currentCutoffDate
  const activeMemories = useMemo(() => {
    if (sortedMemories.length === 0) return [];
    return sortedMemories.filter(m => new Date(m.createdAt).getTime() <= currentCutoffDate.getTime());
  }, [sortedMemories, currentCutoffDate]);

  // Un-revealed pins render dimmed rather than not at all, so you can see where the
  // timeline is going instead of the map looking arbitrarily sparse.
  const upcomingMemories = useMemo(() => {
    if (sortedMemories.length === 0) return [];
    return sortedMemories.filter(m => new Date(m.createdAt).getTime() > currentCutoffDate.getTime());
  }, [sortedMemories, currentCutoffDate]);

  const [renderedMemories, setRenderedMemories] = useState([]);
  const exitTimersRef = useRef(new Map());

  // Keep exiting markers mounted briefly so GSAP can animate them out.
  useEffect(() => {
    const activeMap = new Map(activeMemories.map((m) => [m._id, m]));

    setRenderedMemories((prev) => {
      const prevMap = new Map(prev.map((item) => [item.memory._id, item]));
      const next = [];

      activeMap.forEach((memory, id) => {
        const existing = prevMap.get(id);
        const exitTimer = exitTimersRef.current.get(id);

        if (exitTimer) {
          clearTimeout(exitTimer);
          exitTimersRef.current.delete(id);
        }

        next.push({
          memory,
          isExiting: false,
          shouldAnimateIn: !existing || existing.isExiting,
        });
      });

      prev.forEach((item) => {
        if (!activeMap.has(item.memory._id)) {
          next.push({
            memory: item.memory,
            isExiting: true,
            shouldAnimateIn: false,
          });
        }
      });

      return next;
    });
  }, [activeMemories]);

  useEffect(() => {
    renderedMemories.forEach((item) => {
      const id = item.memory._id;

      if (!item.isExiting || exitTimersRef.current.has(id)) {
        return;
      }

      const timer = setTimeout(() => {
        setRenderedMemories((prev) => prev.filter((entry) => entry.memory._id !== id));
        exitTimersRef.current.delete(id);
      }, 260);

      exitTimersRef.current.set(id, timer);
    });
  }, [renderedMemories]);

  useEffect(() => {
    return () => {
      exitTimersRef.current.forEach((timer) => clearTimeout(timer));
      exitTimersRef.current.clear();
    };
  }, []);

  // Get current date strings for display
  const { currentYear, currentMonth } = useMemo(() => {
    if (sortedMemories.length === 0) return { currentYear: "----", currentMonth: "No Memories" };
    const date = new Date(startYear, startMonth + currentTick, 1);
    return {
      currentYear: date.getFullYear(),
      currentMonth: date.toLocaleDateString("en-US", { month: "long" })
    };
  }, [sortedMemories, startYear, startMonth, currentTick]);



  const handleRulerScroll = useCallback((e) => {
    const viewport = e.currentTarget;

    if (scrollFrameRef.current) {
      cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      const rawIndex = Math.round(viewport.scrollLeft / tickWidth);
      const nextTick = Math.max(0, Math.min(maxMonthTicks, rawIndex));

      setCurrentTick((prev) => (prev === nextTick ? prev : nextTick));
    });
  }, [maxMonthTicks]);

  const handleRulerMouseDown = (e) => {
    const viewport = rulerViewportRef.current;
    if (!viewport) return;

    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = viewport.scrollLeft;
  };

  const handleRulerMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const viewport = rulerViewportRef.current;
    if (!viewport) return;

    const delta = e.clientX - dragStartXRef.current;
    viewport.scrollLeft = dragStartScrollLeftRef.current - delta;
  };

  const handleRulerMouseUp = () => {
    isDraggingRef.current = false;
  };

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative w-full h-full min-h-[500px] flex-1 ${dark ? "map-dark-filter" : ""}`}>
      <MapContainer
        center={[19.0866, 72.9095]}
        zoom={2}
        zoomControl={false}
        className="w-full h-full bg-main dark:bg-dmain"
        style={{ height: '100%', minHeight: "calc(100vh - 80px)" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={tileUrl}
        />
        {/* Memory pins */}
        {renderedMemories.map(({ memory, isExiting, shouldAnimateIn }) => {
          return (
            <CustomMarker
              key={memory._id}
              memory={memory}
              isExiting={isExiting}
              shouldAnimateIn={shouldAnimateIn}
              onClick={() => onPinClick && onPinClick(memory._id)}
            />
          );
        })}

        {upcomingMemories.map((memory) => (
          <CustomMarker
            key={`upcoming-${memory._id}`}
            memory={memory}
            dimmed
            shouldAnimateIn={false}
          />
        ))}

        <ZoomControl position="topleft" />
      </MapContainer>

      {/* Scrubber */}
      {sortedMemories.length > 0 && (
        <div
          className="absolute z-[400] left-1/2 -translate-x-1/2 flex flex-col rounded-[14px] overflow-hidden"
          style={{ bottom: 28, width: 860, maxWidth: '95%', background: 'rgba(14,14,14,.9)', backdropFilter: 'blur(10px)', border: '1px solid #2b2b2b' }}
        >
          {/* Readout row */}
          <div className="flex items-center gap-3" style={{ padding: '16px 20px 14px', borderBottom: '1px solid #1f1f1f' }}>
            <span className="font-black leading-none text-white" style={{ fontFamily: '"Archivo Black", sans-serif', fontSize: 30 }}>
              {currentYear}
            </span>
            <span className="text-[13px] font-semibold uppercase text-white" style={{ letterSpacing: '.2em' }}>
              {currentMonth}
            </span>
            <span className="text-[12.5px] text-[#a0a0a0] ml-1">
              Showing {activeMemories.length} of {sortedMemories.length} memories up to this month
            </span>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => scrollToTick(currentTick - 1)}
                aria-label="Previous month"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/10"
                style={{ border: '1px solid #2b2b2b' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => scrollToTick(currentTick + 1)}
                aria-label="Next month"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/10"
                style={{ border: '1px solid #2b2b2b' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Ruler */}
          <div className="relative" style={{ height: 76, padding: '0 20px' }}>
            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center" style={{ top: 8 }}>
              <div className="w-[2px] h-[42px] rounded-full" style={{ background: '#FEAC5E', boxShadow: '0 0 12px rgba(251,146,60,.45)' }}></div>
              <div className="mt-1 w-2 h-2 rounded-full" style={{ background: '#FEAC5E' }}></div>
            </div>

            <div
              ref={rulerViewportRef}
              onScroll={handleRulerScroll}
              onMouseDown={handleRulerMouseDown}
              onMouseMove={handleRulerMouseMove}
              onMouseUp={handleRulerMouseUp}
              onMouseLeave={handleRulerMouseUp}
              className="w-full h-full overflow-x-auto scrollbar-hide snap-x snap-mandatory cursor-grab active:cursor-grabbing select-none"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
            >
              <div
                className="relative flex items-start h-full pt-3"
                style={{
                  width: `${(maxMonthTicks + 1) * tickWidth}px`,
                  paddingLeft: "calc(50% - 12px)",
                  paddingRight: "calc(50% - 12px)",
                  boxSizing: "content-box",
                }}
              >
                {Array.from({ length: maxMonthTicks + 1 }).map((_, i) => {
                  const isYear = (startMonth + i) % 12 === 0;
                  const yearLabel = startYear + Math.floor((startMonth + i) / 12);

                  return (
                    <div
                      key={i}
                      className="relative shrink-0 snap-center flex flex-col items-center justify-start"
                      style={{ width: `${tickWidth}px` }}
                    >
                      <div
                        className="rounded-full"
                        style={isYear
                          ? { width: 3, height: 22, background: '#fff' }
                          : { width: 1.5, height: 12, background: '#fff', opacity: 0.6 }}
                      ></div>

                      {isYear && (
                        <span className="mt-2 text-[10px] font-bold text-white leading-none whitespace-nowrap">
                          {yearLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineMapView;
