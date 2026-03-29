import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Layout/Navbar';
import PostModal from '../components/Memories/PostModal';
import { Search } from 'lucide-react';

const CATEGORIES = ["Travel", "Nature", "Food", "Events", "People", "Milestones", "Culture", "Other"];

const ExplorePage = () => {
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

    return (
        <div className="w-full min-h-screen bg-gray-50 dark:bg-dmain flex flex-col items-center pt-[70px]">
            <Navbar />

            <div className="w-full max-w-6xl px-4 py-8 flex flex-col items-center">
                {/* Search Bar */}
                <form onSubmit={handleSearch} className="w-full max-w-2xl mb-8 relative">
                    <input
                        type="text"
                        placeholder="Search for moments, concepts, or semantic ideas..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-full border border-gray-300 dark:border-dborderColor bg-white dark:bg-dborderColor/50 text-txt dark:text-dtxt outline-none focus:ring-2 focus:ring-main shadow-sm transition-all"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-main text-dmain px-4 py-1.5 rounded-full text-sm hover:opacity-90 transition-opacity">
                        Search
                    </button>
                </form>

                {/* Categories */}
                <div className="flex flex-wrap justify-center gap-3 mb-10 w-full max-w-4xl">
                    <button
                        onClick={() => setCategory("")}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${category === "" ? 'bg-gradient-main text-main' : 'bg-white dark:bg-dborderColor border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                        For You
                    </button>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${category === cat ? 'bg-gradient-main text-main' : 'bg-white dark:bg-dborderColor border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dlightMain2'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-main border-solid"></div>
                    </div>
                ) : memories.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 w-full">
                        {memories.map(memory => (
                            <div
                                key={memory._id}
                                onClick={() => {
                                    setOpenReasonMemoryId(null);
                                    setSelectedMemoryId(memory._id);
                                }}
                                className="group cursor-pointer relative aspect-square overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-gray-200"
                            >
                                <button
                                    type="button"
                                    onClick={(e) => toggleReasonTooltip(e, memory._id)}
                                    className="absolute top-2 right-2 z-30 h-7 w-7 rounded-full bg-black/55 text-white text-sm font-semibold flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                    aria-label="Why this was recommended"
                                    title="Why this was recommended"
                                >
                                    i
                                </button>

                                {openReasonMemoryId === memory._id && (
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute z-30 top-10 right-2 w-[220px] rounded-xl bg-black/85 text-white p-3 text-xs leading-relaxed shadow-lg"
                                    >
                                        {memory.recommendationReason || "Recommended based on your interests, activity, and available posts."}
                                    </div>
                                )}

                                <img
                                    src={memory.photoUrl}
                                    alt={memory.title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                    <h3 className="text-white font-semibold truncate text-lg">{memory.title}</h3>
                                    <p className="text-gray-200 text-sm truncate">{memory.category}</p>
                                    {memory.user && (
                                        <div className="flex items-center gap-2 mt-2">
                                            {memory.user.profilePic ? (
                                                <img src={memory.user.profilePic} className="w-6 h-6 rounded-full object-cover" alt={memory.user.name} />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center">
                                                    <i className="fa-solid fa-user text-[10px] text-white"></i>
                                                </div>
                                            )}
                                            <span className="text-white text-xs font-medium">{memory.user.name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-60 text-gray-500 dark:text-gray-400">
                        <Search size={48} className="mb-4 opacity-50" />
                        <p className="text-lg">No posts found to recommend.</p>
                        <p className="text-sm mt-2 max-w-md text-center">Try adjusting your search query, selecting a different category, or following more people.</p>
                    </div>
                )}
            </div>

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
