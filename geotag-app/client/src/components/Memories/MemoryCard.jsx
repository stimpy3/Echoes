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

  const openPostModal = () => setShowPostModal(true);

  useEffect(() => {
    if (showPostModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
  }, [showPostModal]);

  return (
    <>
      <div className="rounded-xl border border-hairline dark:border-dhairline overflow-hidden">
        <div className="relative h-[170px] bg-lightMain dark:bg-dlightMain">
          <img
            src={memory.photoUrl}
            alt={memory.title}
            onClick={openPostModal}
            className="w-full h-full object-cover cursor-pointer"
          />

          <div className="absolute bottom-[10px] left-[10px] flex gap-2 z-20">
            <button
              onClick={(e) => { e.stopPropagation(); handleLike(e); }}
              className="flex items-center gap-1 bg-black/55 backdrop-blur-md text-white px-[9px] py-1 rounded-full text-[11.5px] font-semibold"
            >
              <Heart size={13} className={likes.includes(currentUserId) ? "fill-red-500 text-red-500" : ""} />
              {likes.length}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); openPostModal(); }}
              className="flex items-center gap-1 bg-black/55 backdrop-blur-md text-white px-[9px] py-1 rounded-full text-[11.5px] font-semibold"
            >
              <MessageCircle size={13} />
              {memory.comments?.length || 0}
            </button>
          </div>
        </div>

        <div className="px-3 pt-[10px] pb-3 cursor-pointer" onClick={openPostModal}>
          <p className="text-sm font-semibold text-txt dark:text-dtxt truncate">{memory.title}</p>
          <p className="text-xs text-txt2 dark:text-dtxt2 truncate mt-0.5">
            {[memory.location?.address, memory.createdAt ? new Date(memory.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
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
