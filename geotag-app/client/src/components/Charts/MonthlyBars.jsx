import React from "react";

/* Flexbox bars per the design spec — replaces the d3 SVG bar chart. Months up to and
   including the current one get the gradient fill; future months are flat and muted. */
const MonthlyBars = ({ data = [] }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  const currentMonthIndex = new Date().getMonth();
  const peakIndex = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-end gap-[10px]">
        {data.map((d, i) => {
          const isPast = i <= currentMonthIndex;
          const isPeak = i === peakIndex && d.value > 0;
          return (
            <div key={d.name} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
              <span
                className={`text-[10.5px] mb-1 ${isPeak ? 'font-bold text-txt dark:text-dtxt' : 'text-txt2 dark:text-dtxt2'}`}
              >
                {d.value}
              </span>
              <div
                className={`w-full rounded-t-[4px] ${isPast ? '' : 'bg-lightMain dark:bg-[#222]'}`}
                style={{
                  height: `${(d.value / max) * 100}%`,
                  minHeight: 2,
                  background: isPast ? 'linear-gradient(45deg,#fc9b41,#d557e3,#3ed8e3)' : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[10px] pt-2 border-t border-hairline dark:border-dhairline mt-2">
        {data.map((d, i) => (
          <span
            key={d.name}
            className={`flex-1 text-center text-[10.5px] ${
              i === peakIndex && d.value > 0
                ? 'font-bold text-txt dark:text-dtxt'
                : i > currentMonthIndex
                ? 'text-[#c9c5bd]'
                : 'text-txt2 dark:text-dtxt2'
            }`}
          >
            {d.name}
          </span>
        ))}
      </div>
    </div>
  );
};

export default MonthlyBars;
