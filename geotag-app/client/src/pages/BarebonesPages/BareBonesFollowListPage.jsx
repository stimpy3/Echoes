
const BareBonesFollowListPage = () => {
  

  return (
    <div className="w-full min-h-screen p-4 bg-main dark:bg-dmain">
      {/*skeleton */}
       <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-3 rounded-lg  bg-lightMain dark:bg-dslightLightMain animate-pulse"
            >
              <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-[#191919]" />
              <div className="flex flex-col flex-1 gap-2">
                <div className="h-4 bg-gray-300 dark:bg-[#191919] rounded w-[100px]" />
                <div className="h-3 bg-gray-300 dark:bg-[#191919] rounded w-[200px]" />
              </div>
            </div>
          ))}
        </div>
       
    </div>
  );
};

export default BareBonesFollowListPage;
