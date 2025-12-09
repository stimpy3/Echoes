import { ChevronLeft, Search, MessageSquareDot } from "lucide-react";

const BareBonesChatPage = () => {
  
 return (
    <section className="min-w-[300px] w-[400px] bg-lightMain dark:bg-dfadeColor h-full border-r border-borderColor dark:border-dborderColor flex flex-col">

      {/* Header Skeleton */}
      <div className="w-full h-fit py-[10px] bg-main dark:bg-dmain flex flex-col">
            <div className="w-full h-[35px] flex relative">
              <div
                className="absolute top-1/2 -translate-y-[50%] flex items-center cursor-pointer"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft
                  className="text-txt2 dark:text-dtxt"
                  size={28}
                />
              </div>

              <div className="w-full h-full mb-[10px] flex justify-center items-center font-semibold text-[1.3rem] text-transparent bg-clip-text bg-gradient-main">
                <h1 className="text-transparent bg-clip-text bg-gradient-mainBright">
                  Messages
                </h1>
              </div>
            </div>

            {/* Search */}
            <div className="flex w-full h-[45px] rounded-[10px] items-center px-[10px]">
              <div className="rounded-[10px] relative w-full h-4/5">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-txt2 dark:text-dtxt2"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search"
                  className="w-full h-full pl-10 rounded-[10px] bg-lightMain dark:bg-dfadeColor"
                />
              </div>
            </div>
          </div>


      {/* Chat list skeleton rows */}
      <div className="flex flex-col">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-3 rounded-lg bg-lightMain dark:bg-dslightLightMain animate-pulse"
          >
            <div className="min-w-10 h-10 rounded-full bg-gray-300 dark:bg-[#191919]" />

            <div className="flex flex-col flex-1 gap-2">
              <div className="h-4 bg-gray-300 dark:bg-[#191919] rounded w-[120px]" />
              <div className="h-3 bg-gray-300 dark:bg-[#191919] rounded w-[180px]" />
            </div>
          </div>
        ))}
      </div>

    </section>
  );
};

export default BareBonesChatPage;