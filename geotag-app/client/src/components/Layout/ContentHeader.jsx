import { Search } from 'lucide-react';

/*
Shared 72px header for every rail screen: Title, optional Meta, optional inline
search, then a trailing control (primary gradient action or a segmented pill group)
pushed right with margin-left: auto.
*/
const ContentHeader = ({ title, meta, search, trailing, leading }) => (
  <header className="h-[72px] flex items-center gap-5 px-8 border-b border-hairline dark:border-dhairline">
    {leading}
    <h1 className="text-[22px] font-bold tracking-[-0.01em] text-txt dark:text-dtxt whitespace-nowrap">{title}</h1>
    {meta && <span className="text-[12.5px] text-txt2 dark:text-dtxt2 whitespace-nowrap">{meta}</span>}
    {search && (
      <div className="relative max-w-[400px] w-full">
        <Search size={16} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-txt2 dark:text-dtxt2" />
        {search}
      </div>
    )}
    {trailing && <div className="ml-auto flex items-center gap-3">{trailing}</div>}
  </header>
);

/* padding: 9px 14px 9px 38px; rounded-full; slightLightMain / #1c1c1c */
export const HeaderSearchInput = (props) => (
  <input
    type="text"
    className="w-full pl-[38px] pr-[14px] py-[9px] rounded-full text-sm bg-slightLightMain dark:bg-[#1c1c1c] text-txt dark:text-dtxt placeholder:text-txt2 dark:placeholder:text-dtxt2 focus-visible:ring-2 focus-visible:ring-accentMain focus-visible:ring-offset-2 outline-none"
    {...props}
  />
);

/* Segmented pill group — year selector, List/Map toggle. */
export const SegmentedPills = ({ options, value, onChange }) => (
  <div className="flex items-center gap-1 p-1 rounded-full bg-slightLightMain dark:bg-[#1c1c1c]">
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-full text-[12.5px] transition-colors focus-visible:ring-2 focus-visible:ring-accentMain
            ${active ? 'bg-dmain text-white dark:bg-main dark:text-black font-semibold' : 'text-txt dark:text-dtxt'}`}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

/* Second 50-52px strip below the header: category / tab filters with a gradient
   underline on the active item. */
export const FilterRow = ({ options, value, onChange }) => (
  <div className="h-[52px] flex items-center gap-7 px-8 border-b border-hairline dark:border-dhairline">
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`relative h-full flex items-center text-[13px] focus-visible:ring-2 focus-visible:ring-accentMain
            ${active ? 'text-txt dark:text-dtxt font-semibold' : 'text-[#757575]'}`}
        >
          {opt.label}
          {active && (
            <span aria-hidden="true" className="absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-main" />
          )}
        </button>
      );
    })}
  </div>
);

export default ContentHeader;
