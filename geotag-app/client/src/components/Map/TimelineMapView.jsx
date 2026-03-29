import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../../context/ThemeContext";
import CustomMarker from "./CustomMarker";



const TimelineMapView = ({ memories, onPinClick }) => {
  const { dark } = useTheme();

  const tileUrls = {
    light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  };
  const mapStyle = dark ? "dark" : "light";

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
    <div className="relative w-full h-full min-h-[500px] flex-1">
      <MapContainer
        center={[19.0866, 72.9095]}
        zoom={2}
        zoomControl={false}
        className="w-full h-full bg-main dark:bg-dmain"
        style={{ height: '100%', minHeight: "calc(100vh - 80px)" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url={tileUrls[mapStyle]}
          subdomains={["a", "b", "c", "d"]}
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

        <ZoomControl position="topleft" />
      </MapContainer>

      {/* Date Display Overlay (Top Left) */}
      <div className="absolute top-2 left-8 z-[400] px-6 py-3 rounded-2xl transition-all duration-300 pointer-events-none">
        <h2 className="text-3xl md:text-4xl font-bold text-txt dark:text-dtxt tracking-tighter archivo leading-none">
          {currentYear}
        </h2>
        <h3 className="text-sm md:text-base font-medium text-lightTxt dark:text-dlightTxt uppercase tracking-[0.2em] mt-1">
          {currentMonth}
        </h3>
      </div>

      {/* Timeline Controls Overlay (Bottom Center) - Only show if posts exist */}
      {sortedMemories.length > 0 && (
        <div className="absolute bottom-[70px] left-1/2 -translate-x-1/2 z-[400] overflow-hidden w-[95%] max-w-4xl bg-lightMain/50 dark:bg-dlightMain/50 backdrop-blur-sm rounded-[10px] border border-borderColor/50 dark:border-dborderColor/50 flex flex-col items-center">


          <div className="w-full px-3 sm:px-6">
            <div className="relative w-full pt-2">
              <div className="pointer-events-none absolute inset-y-1 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                <div className="h-[42px] w-[2px] rounded-full bg-orangeMain shadow-[0_0_12px_rgba(251,146,60,0.45)]"></div>
                <div className="mt-1 h-2 w-2 rounded-full bg-orangeMain"></div>
              </div>

              <div
                ref={rulerViewportRef}
                onScroll={handleRulerScroll}
                onMouseDown={handleRulerMouseDown}
                onMouseMove={handleRulerMouseMove}
                onMouseUp={handleRulerMouseUp}
                onMouseLeave={handleRulerMouseUp}
                className="w-full overflow-x-auto scrollbar-hide snap-x snap-mandatory cursor-grab active:cursor-grabbing select-none"
                style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
              >
                <div
                  className="relative flex items-start h-[60px]"
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
                          className={`${isYear
                            ? "w-[3px] h-[22px] bg-txt dark:bg-dtxt"
                            : "w-[1.5px] h-[12px] bg-txt2/60 dark:bg-dtxt2/60"
                            } rounded-full`}
                        ></div>

                        {isYear && (
                          <span className="mt-2 text-[10px] font-bold text-txt dark:text-dtxt leading-none whitespace-nowrap">
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
        </div>
      )}
    </div>
  );
};

export default TimelineMapView;
