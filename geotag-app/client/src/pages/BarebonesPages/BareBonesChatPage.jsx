import { Search } from "lucide-react";

const BareBonesChatPage = () => {
  return (
    <section className="w-[320px] shrink-0 bg-main dark:bg-[#0e0e0e] h-full border-r border-hairline dark:border-dhairline flex flex-col">
      <div className="h-[112px] p-5 flex flex-col gap-3 shrink-0">
        <h1 className="text-[22px] font-bold text-txt dark:text-dtxt">Messages</h1>
        <div className="relative">
          <Search size={16} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-txt2 dark:text-[#8a8a8a]" />
          <input
            type="text"
            disabled
            placeholder="Search"
            className="w-full pl-[38px] pr-3 py-[9px] rounded-full text-sm bg-slightLightMain dark:bg-[#1c1c1c] text-txt dark:text-dtxt placeholder:text-txt2 dark:placeholder:text-[#8a8a8a] outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[72px] flex items-center gap-3 px-5 border-b border-hairline dark:border-[#1c1c1c] animate-pulse">
            <div className="w-[38px] h-[38px] rounded-full bg-lightMain2 dark:bg-[#2b2b2b] shrink-0" />
            <div className="flex flex-col flex-1 gap-2">
              <div className="h-3 rounded bg-lightMain2 dark:bg-[#2b2b2b] w-[110px]" />
              <div className="h-2.5 rounded bg-lightMain2 dark:bg-[#2b2b2b] w-[160px]" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default BareBonesChatPage;
