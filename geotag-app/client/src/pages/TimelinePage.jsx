import React, { useRef, useEffect, useState } from 'react';
import { useTheme } from "../context/ThemeContext";
import Navbar from '../components/Layout/Navbar';
import GlareHover from '../components/Layout/GlareHover';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import axios from "axios";

const TimelinePage = () => {
  const { dark } = useTheme();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const currentMonthIndex = new Date().getMonth();
  const [memories, setMemories] = useState([]);
  const carouselRefs = useRef([...Array(12)].map(() => React.createRef()));
  const monthRefs = useRef([...Array(12)].map(() => React.createRef()));
  
  //State to track overflow for each month carousel
  const [hasOverflow, setHasOverflow] = useState(Array(12).fill(false));

  //check overflow after initial render
  useEffect(() => {
    const overflowStatus = carouselRefs.current.map(ref => {
      const el = ref.current;
      if (!el) return false;
      return el.scrollWidth > el.clientWidth;
    });
    setHasOverflow(overflowStatus);
  }, []);


  const BASE_URL=import.meta.env.VITE_BASE_URL || "http://localhost:5000";
  //Scroll to current month on mount only if it's the current year
  useEffect(() => {
    if (selectedYear === new Date().getFullYear()) {
      const currentMonthDiv = monthRefs.current[currentMonthIndex].current;
      if (currentMonthDiv) {
        currentMonthDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedYear, currentMonthIndex]);

  const scrollCarousel = (monthIndex, direction) => {
    const carousel = carouselRefs.current[monthIndex].current;
    if (carousel) {
      const scrollAmount = 200;
      carousel.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
  };

  // Determine if there are memories from previous years
  const memoryYears = Array.from(new Set(memories.map(m => new Date(m.createdAt).getFullYear()))).sort((a,b)=>a-b);
  const minYear = memoryYears.length > 0 ? Math.min(...memoryYears) : new Date().getFullYear();
  const hasPreviousYear = selectedYear > minYear;
  const isCurrentYearRealTime = selectedYear === new Date().getFullYear();

  // Group memories by month for the selected year
  const memoriesByMonth = Array.from({ length: 12 }, () => []);
  memories.forEach(memory => {
    const memoryDate = new Date(memory.createdAt);
    if (memoryDate.getFullYear() === selectedYear) {
      const monthIndex = memoryDate.getMonth();
      memoriesByMonth[monthIndex].push(memory);
    }
  });

   //fetch memories on mount
   useEffect(()=>{
   const fetchMemories=async()=>{
    try{
        const res= await axios.get(`${BASE_URL}/api/memory/fetchmemory`, {withCredentials: true });// credentials:true is crucial for sending cookies
        setMemories([...memories, ...(res.data.memories || [])]);
    }
    catch(err){
      console.error("Failed to fetch memories:",err);
    }
   }
   fetchMemories();
  },[]);
  

  return (
    <div className="bg-main dark:bg-dmain w-full min-h-screen flex flex-col">
      <Navbar />

      <div className="w-full flex ">
        {/* Left Timeline */}
        <section className="sidebarSection  w-[17%] max-w-[200px] bg-main dark:bg-dmain min-h-screen flex flex-col">
          <div
            data-label="year section"
            className="archivo leading-none w-full text-txt dark:text-dtxt text-[2.5rem] h-[130px] pb-[20px] pt-[70px] flex justify-center items-center gap-4"
          >
            <button 
              onClick={() => setSelectedYear(prev => prev - 1)} 
              className={`text-lightTxt dark:text-dlightTxt hover:text-txt dark:hover:text-dtxt transition-colors ${!hasPreviousYear ? 'opacity-0 pointer-events-none' : ''}`}
            >
              <ChevronLeft size={30} />
            </button>
            <span>{selectedYear}</span>
            <button 
              onClick={() => setSelectedYear(prev => prev + 1)}
              disabled={isCurrentYearRealTime}
              className={`text-lightTxt dark:text-dlightTxt hover:text-txt dark:hover:text-dtxt transition-colors ${isCurrentYearRealTime ? 'opacity-0 pointer-events-none' : ''}`}
            >
              <ChevronRight size={30} />
            </button>
          </div>

          <section className="w-full flex">
            {/* Month labels */}
            <section className="w-[70%] flex flex-col px-[10px]">
              <div
                data-label="month section"
                className="w-full flex flex-col items-end text-txt dark:text-dtxt"
              >
                {[
                  'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
                ].map((month, i) => (
                  <div
                    key={i}
                    className="w-fit h-[20px] mb-[200px] leading-none flex items-center"
                  >
                    {month}&nbsp;
                    <p className="text-[0.7rem] text-lightTxt dark:text-dlightTxt">
                      {` [${memoriesByMonth[i].length}]`}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Circles + lines */}
            <section className="w-[30%] flex flex-col items-center pb-[20px]">
              <div className="flex flex-col items-center">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div
                      data-label="circle"
                      className={`w-[20px] aspect-square rounded-full border-[2px] flex items-center justify-center ${
                        isCurrentYearRealTime && i === currentMonthIndex
                          ? 'border-orangeMain'
                          : 'border-lightMain2 dark:border-dborderColor'
                      }`}
                    >
                      <div
                        data-label="inner circle"
                        className={`w-[10px] aspect-square rounded-full ${
                          isCurrentYearRealTime && i === currentMonthIndex
                            ? 'bg-orangeMain'
                            : 'bg-transparent'
                        }`}
                      ></div>
                    </div>

                    {/* Lines logic: only show colorful line if current year real-time and it's current or before current month */}
                    {i < 11 && (
                      <div
                        data-label="vertLine"
                        className={`h-[200px] ${
                          isCurrentYearRealTime && i === currentMonthIndex
                            ? 'bg-gradient-to-b from-orangeMain via-pinkMain to-cyanMain w-[5px]'
                            : 'bg-lightMain dark:bg-dborderColor w-[2px]'
                        }`}
                      ></div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </section>
        </section>

        {/* Right Timeline */}
        <section className="timelineSection w-[83%] flex-1 bg-lightMain dark:bg-dslightLightMain min-h-screen flex flex-col pt-[130px]">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i}>
              <div
                data-label="line container"
                className="w-full h-[20px] flex items-center px-[20px]"
              >
                <div
                  data-label="line"
                  className='w-full h-[2px] rounded bg-main dark:bg-dlightMain'
                ></div>
              </div>

              {/* Month container with carousel */}
              <div
                ref={monthRefs.current[i]}
                data-label="month container"
                className={`w-full h-[200px] flex items-start px-[40px] relative`}
              >
                {/* Left scroll button - only if overflow */}
                {hasOverflow[i] && (
                  <button
                    className="absolute z-[50] left-5 top-[calc(40%+10px)] -translate-y-1/2 rounded-full flex items-center justify-center aspect-square w-[30px] bg-dmain dark:bg-main text-dtxt dark:text-txt shadow-md"
                    onClick={() => scrollCarousel(i, -1)}
                  >
                    <ChevronLeft />
                  </button>
                )}

                {/* Right scroll button - only if overflow */}
                {hasOverflow[i] && (
                  <button
                    className="absolute z-[50] right-5 top-[calc(40%+10px)] -translate-y-1/2 rounded-full flex items-center justify-center aspect-square w-[30px] bg-dmain dark:bg-main text-dtxt dark:text-txt shadow-md"
                    onClick={() => scrollCarousel(i, 1)}
                  >
                    <ChevronRight />
                  </button>
                )}

                {/* Scrollable carousel */}
                <section
                  ref={carouselRefs.current[i]}
                  data-label="image carousel container"
                  className=" w-full h-full flex space-x-3 overflow-hidden scrollbar-hide"
                  style={{ scrollBehavior: 'smooth' }}
                >
                  {memoriesByMonth[i].length > 0 ? (
                    memoriesByMonth[i].map((memory, idx) => {
                      //Array of color themes for pins
                      const pinColors = [
                        { head: 'from-red-500 to-red-800', inner: 'bg-red-900', stem: 'bg-red-950' },
                        { head: 'from-blue-500 to-blue-800', inner: 'bg-blue-900', stem: 'bg-blue-950' },
                        { head: 'from-green-500 to-green-800', inner: 'bg-green-900', stem: 'bg-green-950' },
                        { head: 'from-yellow-400 to-yellow-600', inner: 'bg-yellow-700', stem: 'bg-yellow-800' },
                        { head: 'from-pink-500 to-pink-800', inner: 'bg-pink-900', stem: 'bg-pink-950' },
                        { head: 'from-purple-500 to-purple-800', inner: 'bg-purple-900', stem: 'bg-purple-950' },
                      ];
                  
                       // Pick a random color
                      const color = pinColors[Math.floor(Math.random() * pinColors.length)];
                  
                      const options = [-0.5, 0, 0.5];
                      const rotation = options[Math.floor(Math.random() * options.length)];
                  
                        return (
                       <GlareHover
                       glareOpacity={0.3}
                       glareAngle={-30}
                       glareSize={300}
                       transitionDuration={900}
                       playOnce={false}
                       glareColor="#ffffff">
                            <article
                              key={memory._id}
                              data-label="image container"
                              className="relative h-[200px] p-[8px] w-[200px] border-[1px] shadow-custom-dark-lg border-lightMain2 bg-main dark:bg-dtxt overflow-hidden"
                              style={{ transform: `rotate(${rotation}deg)` }}
                              >
                              {/* Push Pin */}
                              <div className="absolute z-[10] flex flex-col items-center left-1/2 -translate-x-1/2 top-[6px] pointer-events-none">
                                {/* Pin head */}
                                <div
                                  className={`relative flex items-center justify-center bg-gradient-to-b ${color.head} rounded-full shadow-md w-[18px] aspect-square`}
                                >
                                  {/* Inner dome */}
                                  <div className={`${color.inner} w-[8px] aspect-square rounded-full shadow-inner`}></div>
                                  {/* Highlight */}
                                  <div className="absolute top-[3px] left-[4px] w-[4px] h-[4px] bg-white/60 rounded-full"></div>
                                </div>
                                {/* Pin stem */}
                                <div className={`w-[3px] h-[4px] ${color.stem} rounded-b-full`}></div>
                                {/* Drop shadow */}
                                <div className="w-[8px] h-[6px] bg-black/30 blur-[2px] rounded-full"></div>
                              </div>
                          
                              {/* Image */}
                              <img
                                src={memory.photoUrl}
                                alt={memory.title}
                                className="w-full h-[85%] object-cover"
                              />
                            </article>
                          </GlareHover>
                        );
                      })
                    ) : (
                      <p className="text-lightTxt dark:text-dlightTxt text-sm">
                        No memories this month
                      </p>
                    )}
                </section>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
     
  );
};

export default TimelinePage;
