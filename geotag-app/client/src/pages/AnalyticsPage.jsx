import { Link } from 'react-router-dom';
import { NavLink } from "react-router-dom";
import Navbar from '../components/Layout/Navbar';
import GradientText from '../components/Layout/GradientText';
import Tooltip from "../components/Layout/Tooltip";
import { CircleQuestionMark } from 'lucide-react';
import React from "react";
import PackedBubble from "../components/Charts/PackedBubble";
import BarChart from "../components/Charts/BarChart";
import { useState,useEffect, useRef } from "react";
import { gsap } from "gsap";
import Aurora from '../components/Layout/Aurora';
import axios from 'axios';
  


const AnalyticsPage = () => {

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";
const [monthlyData, setMonthlyData] = useState([]);

  useEffect(() => {
    const fetchMonthlyMemoryCount = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/analytics/monthlymemorycount`, { withCredentials: true });

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        const formattedData = monthNames.map((month, idx) => {
          // backend months are 1-indexed
          const monthData = res.data.find(item => item._id.month === idx + 1);
          return { name: month, value: monthData ? monthData.count : 0 };
        });

        setMonthlyData(formattedData);
      } catch (err) {
        console.error("Failed to fetch monthly memory count:", err);
      }
    };

    fetchMonthlyMemoryCount();
  }, []);
  
const sampleBubbles = [
  { name: "Travel", value: 12 },
  { name: "Food", value: 6 },
  { name: "Events", value: 4 },
  { name: "People", value: 4 },
  { name: "Milestones", value: 3 },
];

const sampleBars = [
  { name: "Jan", value: 30 },
  { name: "Feb", value: 80 },
  { name: "Mar", value: 45 },
  { name: "Apr", value: 60 },
  { name: "May", value: 20 },
  { name: "Jun", value: 90 },
  { name: "Jul", value: 30 },
  { name: "Aug", value: 80 },
  { name: "Sep", value: 45 },
  { name: "Oct", value: 60 },
  { name: "Nov", value: 20 },
  { name: "Dec", value: 90 },
];
const countRef = useRef(null);

const [animatedCount, setAnimatedCount] = useState(0);
const [memoryCount,setMemoryCount]=useState(0);

useEffect(() => {
  const obj = { val: animatedCount }; // start from current displayed count
  gsap.to(obj, {
    val: memoryCount,
    duration: 1,
    ease: "power1.out",
    onUpdate: () => setAnimatedCount(Math.floor(obj.val))
  });
}, [memoryCount]);


   const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );

  // Observe dark mode dynamically
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setSize({ width, height: width * 0.75 }); // 4:3 aspect ratio, adjust as needed
      }
    };

    updateSize(); // initial size
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);


  //fetching memory count
  useEffect(()=>{
      const fetchMemoryCount= async()=>{
        try{
        const res=await axios.get(`${BASE_URL}/api/analytics/totalmemorycount`,{withCredentials:true});
        setMemoryCount(res.data.count);
        }
        catch(err){
          console.error("failed to fetch memory count",err);
        }
      }

      fetchMemoryCount();
  },[]);

return (
   <div className='relative w-full'>
      { isDark?
    <Aurora  className=" bg-black h-[800px]" colorStops={["#fc9b41", "#d557e3", "#3ed8e3"]} blend={2.0} amplitude={2.0} speed={0.5}/>
      :
      <div className=" bg-lin w-full h-[150px]"
     ></div>
   }
     <div className="w-full min-h-screen bg-main dark:bg-dmain px-[30px] ">
      
       <Navbar />

        <section data-label='memCountSection' className='z-[10] top-[70px] absolute text-center h-fit left-[30px] right-[30px] mt-[0px] mb-[20px] p-[20px] border-[1px] shadow-sm border-borderColor dark:border-dborderColor text-txt dark:text-dtxt rounded-xl bg-[#f3f3f3] dark:bg-[#28282884]'>
               <p className='figtree text-[3rem] flex justify-center'>
                   Memories This year:&nbsp;
                 <GradientText colors={["#fc9b41ff", "#d557e3ff", "#3ed8e3ff"]} animationSpeed={5} showBorder={false} className="w-fit text-[3rem]" ref={countRef}>
                   {animatedCount}
                 </GradientText>
               </p>

        </section>

       <section data-label='graphSection' className='flex flex-wrap justify-between h-fit w-full pt-[50px]'>

          <div  ref={containerRef} className="w-[49.3%] p-[20px] bg-[#f3f3f3] border-[1px] shadow-lg border-borderColor dark:border-dborderColor dark:bg-[#171717] rounded-xl">
             <PackedBubble data={sampleBubbles}  width={size.width}  height={size.height}  />
          </div>

          <div className=" flex items-center w-[49.3%] p-[20px] bg-[#f3f3f3] border-[1px] shadow-lg border-borderColor dark:border-dborderColor dark:bg-[#171717] rounded-xl">
            <BarChart data={monthlyData} />
          </div>

       </section>

       
                        
    </div>
     </div>
);
}
export default AnalyticsPage;