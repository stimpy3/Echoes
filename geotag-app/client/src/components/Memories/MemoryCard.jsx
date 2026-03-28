import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, MessageCircle } from 'lucide-react';
import PostModal from './PostModal';

const MemoryCard = ({ memory, onDelete, onEdit, currentUserId }) => {
  const [showPostModal, setShowPostModal] = useState(false);
  const [likes, setLikes] = useState(memory.likes || []);

  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

  const handleLike = async (e) => {
    e.stopPropagation();
    try {
      const res = await axios.post(`${BASE_URL}/api/memory/like/${memory._id}`, {}, { withCredentials: true });
      setLikes(res.data.likes);
    } catch (err) {
      console.error("Error liking memory:", err);
    }
  };

  const openPostModal = () => {
    setShowPostModal(true);
  };

  useEffect(() => {
    if (showPostModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
  }, [showPostModal]);

  return (
    <>
      <div className="relative h-[250px] bg-lightMain dark:bg-dlightMain shadow-md overflow-hidden transition duration-300">
        <img
          src={memory.photoUrl}
          alt={memory.title}
          onClick={openPostModal} 
          className="w-full h-full object-cover cursor-pointer transition-all duration-500 hover:scale-105"
        />

        <div className="absolute bottom-3 left-3 flex gap-3 z-20 pointer-events-none">
            <button onClick={(e) => { e.stopPropagation(); handleLike(e); }} className="pointer-events-auto flex items-center gap-1 bg-black/40 backdrop-blur-md text-white px-2 py-1 rounded-full text-xs hover:scale-105 transition">
                <Heart size={14} className={likes.includes(currentUserId) ? "fill-red-500 text-red-500" : ""} />
                {likes.length}
            </button>
            <button onClick={(e) => { e.stopPropagation(); openPostModal(); }} className="pointer-events-auto flex items-center gap-1 bg-black/40 backdrop-blur-md text-white px-2 py-1 rounded-full text-xs">
                <MessageCircle size={14} />
                {memory.comments?.length || 0}
            </button>
        </div>
      </div>

     {showPostModal && (
        <PostModal 
          memoryId={memory._id} 
          currentUserId={currentUserId} 
          onClose={() => setShowPostModal(false)}
          onEdit={onEdit}
          onDelete={() => onDelete && onDelete(memory._id)}
        />
      )}
    </>
  );
};

export default MemoryCard;
