import React from "react";

const DIAMETERS = [118, 86, 70, 70, 60];
const VALUE_SIZES = [22, 18, 16, 16, 14];
const FILLS = ['#fc9b41', '#d557e3', '#3ed8e3', '#2daadd', '#C779D0'];
// #3ed8e3 fails contrast with white; every other fill in the set clears it.
const INK = ['#ffffff', '#ffffff', '#0b3c40', '#ffffff', '#ffffff'];

/* Replaces the d3 packed-circle chart with fixed sizes per the design spec — five
   slots, ranked by count, each carrying its own contrast-checked ink. */
const CategoryBubbles = ({ data = [] }) => {
  const top = [...data].sort((a, b) => b.value - a.value).slice(0, 5);

  return (
    <div className="flex items-end justify-center gap-4 flex-wrap py-4">
      {top.map((d, i) => (
        <div
          key={d.name}
          className="rounded-full flex flex-col items-center justify-center shrink-0"
          style={{ width: DIAMETERS[i], height: DIAMETERS[i], background: FILLS[i], color: INK[i] }}
        >
          <span className="font-black leading-none" style={{ fontFamily: '"Archivo Black", sans-serif', fontSize: VALUE_SIZES[i] }}>
            {d.value}
          </span>
          <span className="font-semibold leading-tight text-center px-1" style={{ fontSize: DIAMETERS[i] > 80 ? 11.5 : 9 }}>
            {d.name}
          </span>
        </div>
      ))}
    </div>
  );
};

export default CategoryBubbles;
