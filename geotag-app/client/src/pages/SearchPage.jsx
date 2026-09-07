import { useState } from 'react';
import axios from 'axios';
import { Search, Sparkles } from 'lucide-react';
import Rail from '../components/Layout/Rail';
import { MobileTopBar, MobileTabBar } from '../components/Layout/MobileNav';
import ContentHeader, { HeaderSearchInput, FilterRow } from '../components/Layout/ContentHeader';
import PostModal from '../components/Memories/PostModal';
import { CATEGORY_FILTER_OPTIONS } from '../lib/categories';

/*
Search your own diary — the feature the embedding infrastructure exists for now that the
public Explore feed is gone. "Show me my beach memories", "what did I do in Goa".

Every result belongs to the person searching, so there is deliberately no author byline, no
"why am I seeing this" affordance and no recommendation reason — all of which the old Explore
grid needed and none of which mean anything here.

The backend answers in one of two modes and says which: `semantic` (vector search over the
memory's embedding) or `lexical` (regex fallback). That distinction is surfaced rather than
hidden, because a memory created before the embedding worker ran has no vector at all and can
only ever be found by text — pretending both are the same would make search look broken.
*/
const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [category, setCategory] = useState('');
  const [memories, setMemories] = useState([]);
  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';

  const runSearch = async (q, cat) => {
    if (!q.trim()) return;
    setLoading(true);
    setSubmitted(q.trim());
    try {
      const res = await axios.get(`${BASE_URL}/api/memory/search`, {
        params: { q: q.trim(), ...(cat ? { category: cat } : {}) },
        withCredentials: true,
      });
      setMemories(res.data.memories || []);
      setMode(res.data.mode || null);
    } catch (err) {
      console.error('Search failed', err);
      setMemories([]);
      setMode(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch(query, category);
  };

  const handleCategory = (next) => {
    setCategory(next);
    if (submitted) runSearch(submitted, next);
  };

  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row bg-main dark:bg-dmain">
      <Rail />
      <MobileTopBar />

      <div className="flex-1 min-w-0 flex flex-col pb-[76px] md:pb-0">
        <div className="hidden md:contents">
          <ContentHeader
            title="Search"
            search={
              <form onSubmit={handleSubmit}>
                <HeaderSearchInput
                  placeholder="Search your memories — beach sunsets, Goa, the rainy trip…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </form>
            }
          />
          <FilterRow options={CATEGORY_FILTER_OPTIONS} value={category} onChange={handleCategory} />
        </div>

        {/* Mobile search + chips */}
        <div className="md:hidden px-4 pt-3">
          <form onSubmit={handleSubmit} className="relative">
            <Search size={16} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-txt2 dark:text-dtxt2" />
            <HeaderSearchInput
              placeholder="Search your memories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
          <div className="flex gap-2 overflow-x-auto py-3">
            {CATEGORY_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleCategory(opt.value)}
                className={`shrink-0 px-[14px] py-[6px] rounded-full text-[12.5px] ${
                  category === opt.value
                    ? 'bg-gradient-main text-white'
                    : 'bg-slightLightMain dark:bg-[#1c1c1c] text-txt dark:text-dtxt'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-4 md:p-8">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-accentMain" />
            </div>
          ) : !submitted ? (
            <div className="flex flex-col items-center justify-center h-60 text-txt2 dark:text-dtxt2 text-center">
              <Search size={48} className="mb-4 opacity-50" />
              <p className="text-lg">Search your diary</p>
              <p className="text-sm mt-2 max-w-md">
                Ask for what you remember, not what you titled it — "the beach at sunset",
                "that trip where it rained".
              </p>
            </div>
          ) : memories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-txt2 dark:text-dtxt2 text-center">
              <Search size={48} className="mb-4 opacity-50" />
              <p className="text-lg">Nothing found for "{submitted}"</p>
              <p className="text-sm mt-2 max-w-md">
                Try different words, or clear the category filter.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[12.5px] text-txt2 dark:text-dtxt2 mb-4 flex items-center gap-1.5">
                {mode === 'semantic' ? (
                  <>
                    <Sparkles size={13} className="text-accentMain" />
                    {memories.length} {memories.length === 1 ? 'memory' : 'memories'} matching the meaning of "{submitted}"
                  </>
                ) : (
                  <>
                    {memories.length} {memories.length === 1 ? 'memory' : 'memories'} matching the words "{submitted}"
                  </>
                )}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {memories.map((memory) => (
                  <div
                    key={memory._id}
                    onClick={() => setSelectedMemoryId(memory._id)}
                    className="group cursor-pointer relative overflow-hidden rounded-xl border border-hairline dark:border-dhairline"
                  >
                    <div className="h-[170px] bg-lightMain dark:bg-dlightMain">
                      <img src={memory.photoUrl} alt={memory.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="px-3 pt-[10px] pb-3">
                      <p className="text-sm font-semibold text-txt dark:text-dtxt truncate">{memory.title}</p>
                      <p className="text-xs text-txt2 dark:text-dtxt2 truncate mt-0.5">
                        {[
                          memory.category,
                          memory.location?.address,
                          new Date(memory.memoryDate || memory.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <MobileTabBar />

      {selectedMemoryId && (
        <PostModal memoryId={selectedMemoryId} onClose={() => setSelectedMemoryId(null)} />
      )}
    </div>
  );
};

export default SearchPage;
