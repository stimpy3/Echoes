import React, { useState, useEffect } from "react";
import Rail from '../components/Layout/Rail';
import ContentHeader, { SegmentedPills } from '../components/Layout/ContentHeader';
import CategoryBubbles from "../components/Charts/CategoryBubbles";
import MonthlyBars from "../components/Charts/MonthlyBars";
import axios from 'axios';

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const sampleBubbles = [
  { name: "Travel", value: 12 },
  { name: "Food", value: 6 },
  { name: "Events", value: 4 },
  { name: "People", value: 4 },
  { name: "Milestones", value: 3 },
];

const AnalyticsPage = () => {
  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";
  const [monthlyData, setMonthlyData] = useState(MONTH_NAMES.map((name) => ({ name, value: 0 })));
  const [memoryCount, setMemoryCount] = useState(0);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    const fetchMonthlyMemoryCount = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/analytics/monthlymemorycount`, { withCredentials: true });
        const formattedData = MONTH_NAMES.map((month, idx) => {
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

  useEffect(() => {
    const fetchMemoryCount = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/analytics/totalmemorycount`, { withCredentials: true });
        setMemoryCount(res.data.count);
      } catch (err) {
        console.error("failed to fetch memory count", err);
      }
    };
    fetchMemoryCount();
  }, []);

  const busiestMonth = monthlyData.reduce((best, d) => (d.value > (best?.value ?? -1) ? d : best), null);
  const placesCount = 37;
  const placesCities = 4;

  return (
    <div className="w-full min-h-screen flex bg-main dark:bg-dmain">
      <Rail />
      <div className="flex-1 min-w-0 flex flex-col">
        <ContentHeader
          title="Analytics"
          trailing={
            <SegmentedPills
              options={[
                { value: String(new Date().getFullYear()), label: String(new Date().getFullYear()) },
                { value: String(new Date().getFullYear() - 1), label: String(new Date().getFullYear() - 1) },
                { value: 'all', label: 'All time' },
              ]}
              value={year}
              onChange={setYear}
            />
          }
        />

        <div className="p-8 flex flex-col gap-6">
          {/* Stat row */}
          <div className="flex gap-6 items-stretch">
            <div className="flex-1 relative p-6 pl-7 rounded-xl border border-hairline dark:border-dhairline overflow-hidden">
              <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-main" />
              <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-txt2 dark:text-dtxt2 mb-2">Memories this year</p>
              <p className="font-black leading-none tracking-[-0.02em] text-txt dark:text-dtxt" style={{ fontFamily: '"Archivo Black", sans-serif', fontSize: 56 }}>
                {memoryCount}
              </p>
            </div>

            <div className="w-[200px] p-6 rounded-xl border border-hairline dark:border-dhairline">
              <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-txt2 dark:text-dtxt2 mb-2">Places</p>
              <p className="font-black leading-none tracking-[-0.02em] text-txt dark:text-dtxt" style={{ fontFamily: '"Archivo Black", sans-serif', fontSize: 32 }}>
                {placesCount}
              </p>
              <p className="text-[12.5px] text-txt2 dark:text-dtxt2 mt-1">across {placesCities} cities</p>
            </div>

            <div className="w-[200px] p-6 rounded-xl border border-hairline dark:border-dhairline">
              <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-txt2 dark:text-dtxt2 mb-2">Busiest month</p>
              <p className="font-black leading-none tracking-[-0.02em] text-txt dark:text-dtxt" style={{ fontFamily: '"Archivo Black", sans-serif', fontSize: 32 }}>
                {busiestMonth && busiestMonth.value > 0 ? busiestMonth.name.toUpperCase() : '—'}
              </p>
              <p className="text-[12.5px] text-txt2 dark:text-dtxt2 mt-1">
                {busiestMonth && busiestMonth.value > 0 ? `${busiestMonth.value} memories` : 'No memories yet'}
              </p>
            </div>
          </div>

          {/* Chart row */}
          <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1.35fr' }}>
            <div className="p-6 rounded-xl border border-hairline dark:border-dhairline min-h-0">
              <h2 className="text-[17px] font-semibold text-txt dark:text-dtxt">By category</h2>
              <p className="text-[12.5px] text-txt2 dark:text-dtxt2">Where your memories cluster</p>
              <CategoryBubbles data={sampleBubbles} />
            </div>

            <div className="p-6 rounded-xl border border-hairline dark:border-dhairline min-h-0 flex flex-col">
              <h2 className="text-[17px] font-semibold text-txt dark:text-dtxt">Memories per month</h2>
              <p className="text-[12.5px] text-txt2 dark:text-dtxt2 mb-2">This year</p>
              <div className="flex-1 min-h-[200px]">
                <MonthlyBars data={monthlyData} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
