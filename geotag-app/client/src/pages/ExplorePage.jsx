import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Rail from '../components/Layout/Rail';
import { MobileTopBar, MobileTabBar } from '../components/Layout/MobileNav';
import ContentHeader, { HeaderSearchInput, FilterRow } from '../components/Layout/ContentHeader';
import PostModal from '../components/Memories/PostModal';
import { Search, User } from 'lucide-react';

const CATEGORY_OPTIONS = [
    { value: '', label: 'For You' },
    { value: 'Travel', label: 'Travel' },
    { value: 'Nature', label: 'Nature' },
    { value: 'Food', label: 'Food' },
    { value: 'Events', label: 'Events' },
    { value: 'People', label: 'People' },
    { value: 'Milestones', label: 'Milestones' },
    { value: 'Culture', label: 'Culture' },
];

const RECOMMENDATION_LABELS = {
    semantic: 'Semantic match',
    nearby: 'Near you',
    recent: 'Recently posted',
};

const humanizeSource = (source) => RECOMMENDATION_LABELS[source] || source || 'Recommended';

const ExplorePage = () => {
    const navigate = useNavigate();
    const [memories, setMemories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [category, setCategory] = useState("");
    const [currentUserId, setCurrentUserId] = useState(null);
    const [selectedMemoryId, setSelectedMemoryId] = useState(null);
    const [openReasonMemoryId, setOpenReasonMemoryId] = useState(null);

    const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

    const fetchExploreMemories = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/memory/explore`, {
                params: { category, searchQuery },
                withCredentials: true
            });
            setMemories(res.data.memories || []);
        } catch (err) {
            console.error("Failed to fetch explore feed", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await axios.get(`${BASE_URL}/api/user/navbar`, { withCredentials: true });
                setCurrentUserId(res.data._id);
            } catch (err) { }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        fetchExploreMemories();
    }, [category]); // re-fetch when category changes

    const handleSearch = (e) => {
        e.preventDefault();
        fetchExploreMemories();
    };

    const toggleReasonTooltip = (e, memoryId) => {
        e.stopPropagation();
        setOpenReasonMemoryId((prev) => (prev === memoryId ? null : memoryId));
    };

    const [hero, ...rest] = memories;

    return (
        <div className="w-full min-h-screen flex flex-col md:flex-row bg-main dark:bg-dmain">
            <Rail />
            <MobileTopBar />

            <div className="flex-1 min-w-0 flex flex-col pb-[76px] md:pb-0">
                <div className="hidden md:contents">
                <ContentHeader
                    title="Explore"
                    search={
                        <form onSubmit={handleSearch}>
                            <HeaderSearchInput
                                placeholder="Search for moments, concepts, or ideas..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </form>
                    }
                    trailing={
                        <button
                            type="button"
                            onClick={() => navigate('/home')}
                            className="px-4 h-[38px] rounded-full bg-gradient-mainBright text-white text-[13px] font-semibold"
                        >
                            + New memory
                        </button>
                    }
                />
                <FilterRow options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
                </div>

                {/* Mobile filter chips */}
                <div className="md:hidden flex gap-2 overflow-x-auto px-4 py-3">
                    {CATEGORY_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setCategory(opt.value)}
                            className={`shrink-0 px-[14px] py-[6px] rounded-full text-[12.5px] ${
                                category === opt.value ? 'bg-gradient-main text-white' : 'bg-slightLightMain dark:bg-[#1c1c1c] text-txt dark:text-dtxt'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 p-4 md:p-8">
                    {loading ? (
                        <div className="flex justify-center items-center h-40">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-accentMain border-solid"></div>
                        </div>
                    ) : memories.length > 0 ? (
                        <>
                        {/* Mobile: single column full-width cards */}
                        <div className="md:hidden flex flex-col gap-[14px]">
                            {memories.map((memory) => (
                                <div
                                    key={memory._id}
                                    onClick={() => setSelectedMemoryId(memory._id)}
                                    className="rounded-xl overflow-hidden border border-hairline dark:border-dhairline cursor-pointer"
                                >
                                    <img src={memory.photoUrl} alt={memory.title} className="w-full object-cover" style={{ height: 130 }} />
                                    <div className="px-3 pt-[10px] pb-3">
                                        <p className="text-sm font-semibold text-txt dark:text-dtxt truncate">{memory.title}</p>
                                        <p className="text-xs text-txt2 dark:text-dtxt2 truncate mt-0.5">{memory.category}{memory.user?.name ? ` · ${memory.user.name}` : ''}</p>
                                        {memory.user && (
                                            <div className="flex items-center gap-2 mt-2">
                                                {memory.user.profilePic ? (
                                                    <img src={memory.user.profilePic} className="w-[18px] h-[18px] rounded-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-[18px] h-[18px] rounded-full bg-gray-400 flex items-center justify-center">
                                                        <User size={10} className="text-white" />
                                                    </div>
                                                )}
                                                <span className="text-[11.5px] text-txt dark:text-dtxt">{memory.user.name}</span>
                                                <button
                                                    onClick={(e) => toggleReasonTooltip(e, memory._id)}
                                                    className="ml-auto text-[10.5px] font-semibold text-accentMain"
                                                >
                                                    why?
                                                </button>
                                            </div>
                                        )}
                                        {openReasonMemoryId === memory._id && (
                                            <p className="text-[11px] text-txt2 dark:text-dtxt2 mt-2">
                                                {memory.recommendationReason || "Recommended based on your interests, activity, and available posts."}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div
                            className="hidden md:grid gap-4"
                            style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gridAutoRows: '160px' }}
                        >
                            {/* Hero tile */}
                            <div
                                key={hero._id}
                                onClick={() => { setOpenReasonMemoryId(null); setSelectedMemoryId(hero._id); }}
                                className="group cursor-pointer relative overflow-hidden rounded-xl bg-gray-200"
                                style={{ gridColumn: 'span 2', gridRow: 'span 2' }}
                            >
                                <img src={hero.photoUrl} alt={hero.title} className="w-full h-full object-cover" />
                                <div
                                    className="absolute inset-0"
                                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,.78), transparent 55%)' }}
                                />
                                <div className="absolute left-6 right-6 bottom-[22px] text-white">
                                    <span
                                        className="inline-block px-[10px] py-1 rounded-full text-[10.5px] font-semibold uppercase tracking-[.08em] mb-3"
                                        style={{ background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(6px)' }}
                                    >
                                        {humanizeSource(hero.recommendationSource)}
                                    </span>
                                    <h2 className="text-[28px] font-bold tracking-[-0.01em] truncate">{hero.title}</h2>
                                    {hero.recommendationReason && (
                                        <p className="text-sm max-w-[440px]" style={{ color: 'rgba(255,255,255,.82)' }}>
                                            {hero.recommendationReason}
                                        </p>
                                    )}
                                    {hero.user && (
                                        <div className="flex items-center gap-2 mt-3">
                                            {hero.user.profilePic ? (
                                                <img src={hero.user.profilePic} className="w-6 h-6 rounded-full object-cover" alt={hero.user.name} />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center">
                                                    <User size={12} className="text-white" />
                                                </div>
                                            )}
                                            <span className="text-[13px] font-medium">{hero.user.name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {rest.map(memory => (
                                <div
                                    key={memory._id}
                                    onClick={() => { setOpenReasonMemoryId(null); setSelectedMemoryId(memory._id); }}
                                    className="group cursor-pointer relative overflow-hidden rounded-xl bg-gray-200"
                                >
                                    <button
                                        type="button"
                                        onClick={(e) => toggleReasonTooltip(e, memory._id)}
                                        className="absolute top-2 right-2 z-30 text-[10.5px] font-semibold text-accentMain bg-black/40 rounded-full px-2 py-0.5"
                                        aria-label="Why this was recommended"
                                    >
                                        why?
                                    </button>

                                    {openReasonMemoryId === memory._id && (
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute z-30 top-9 right-2 w-[220px] rounded-xl bg-black/85 text-white p-3 text-xs leading-relaxed shadow-lg"
                                        >
                                            {memory.recommendationReason || "Recommended based on your interests, activity, and available posts."}
                                        </div>
                                    )}

                                    <img
                                        src={memory.photoUrl}
                                        alt={memory.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div
                                        className="absolute inset-0"
                                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,.7), transparent 60%)' }}
                                    />
                                    <div className="absolute left-[14px] right-[14px] bottom-3 text-white">
                                        <h3 className="font-semibold truncate text-sm">{memory.title}</h3>
                                        <p className="truncate text-[11.5px]" style={{ color: 'rgba(255,255,255,.7)' }}>
                                            {memory.category}{memory.distanceKm != null ? ` · ${memory.distanceKm.toFixed(1)} km away` : ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-60 text-txt2 dark:text-dtxt2">
                            <Search size={48} className="mb-4 opacity-50" />
                            <p className="text-lg">No posts found to recommend.</p>
                            <p className="text-sm mt-2 max-w-md text-center">Try adjusting your search query, selecting a different category, or following more people.</p>
                        </div>
                    )}
                </div>
            </div>
            <MobileTabBar />

            {selectedMemoryId && (
                <PostModal
                    memoryId={selectedMemoryId}
                    currentUserId={currentUserId}
                    onClose={() => setSelectedMemoryId(null)}
                />
            )}
        </div>
    );
};

export default ExplorePage;
