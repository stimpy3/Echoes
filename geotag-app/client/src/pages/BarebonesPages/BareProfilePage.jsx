import { useEffect } from "react";



const BareProfilePage = () => {
    useEffect(() => {
  window.scrollTo({ top: 0, behavior: "instant" });
}, []);

  return (
    <div className="bg-main dark:bg-dmain w-full h-screen overflow-hidden flex flex-col px-[30px] pb-[10px]">

      {/* HEADER */}
      <div className="mt-[10px] flex flex-col justify-center items-center w-full  animate-pulse">
        <div className="w-full overflow-hidden">
          <div className="h-[200px] flex items-center border-b border-borderColor dark:border-dborderColor">

            {/* Skeleton PFP */}
            <div className="min-w-36 flex items-center justify-between">
              <div className="w-36 h-36 rounded-full bg-gray-300 dark:bg-[#191919]" />
            </div>

            {/* Skeleton text + stats */}
            <div className="px-[30px] w-full flex flex-col">
              <div className="pb-[30px] w-full">

                <div className="w-[60%] h-5 bg-gray-300 dark:bg-[#191919] rounded mb-3" />
                <div className="w-[40%] h-4 bg-gray-300 dark:bg-[#191919] rounded mb-4" />

                {/* Buttons */}
                <div className="flex gap-4 mt-[10px]">
                  <div className="w-[70px] h-[30px] rounded bg-gray-300 dark:bg-[#191919]" />
                  <div className="w-[70px] h-[30px] rounded bg-gray-300 dark:bg-[#191919]" />
                </div>
              </div>

              {/* Stats */}
              <div className="flex justify-around text-[1.5rem]">
                <div className="w-[60px] h-5 bg-gray-300 dark:bg-[#191919] rounded" />
                <div className="w-[60px] h-5 bg-gray-300 dark:bg-[#191919] rounded" />
                <div className="w-[60px] h-5 bg-gray-300 dark:bg-[#191919] rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="w-full mt-[20px] flex justify-center">
          <div className="flex gap-[40px] p-2">
            <div className="flex flex-col items-center pb-2">
              <div className="w-6 h-6 bg-gray-300 dark:bg-[#191919] rounded mb-1" />
              <div className="w-10 h-3 bg-gray-300 dark:bg-[#191919] rounded" />
            </div>
            <div className="flex flex-col items-center pb-2">
              <div className="w-6 h-6 bg-gray-300 dark:bg-[#191919] rounded mb-1" />
              <div className="w-10 h-3 bg-gray-300 dark:bg-[#191919] rounded" />
            </div>
          </div>
        </div>

        {/* POSTS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[5px] min-h-[80vh] w-full mt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-full h-[250px] bg-gray-300 dark:bg-[#191919] rounded-xl"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default BareProfilePage;
