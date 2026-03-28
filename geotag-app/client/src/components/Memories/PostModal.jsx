import { MapPin, Calendar, Heart, Pencil, Trash, Send } from 'lucide-react';
import axios from 'axios';
import { useState, useEffect } from 'react';

const PostModal = ({ memoryId, onClose, currentUserId, onEdit, onDelete }) => {
  const [memory, setMemory] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [likes, setLikes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  
  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

  useEffect(() => {
    const fetchMemory = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/memory/single/${memoryId}`, { withCredentials: true });
        setMemory(res.data);
        setLikes(res.data.likes || []);
        setEditTitle(res.data.title);
        setEditDesc(res.data.description);
      } catch (err) {
        console.error("Error fetching memory:", err);
      }
    };
    fetchMemory();
  }, [memoryId, BASE_URL]);

  const handleLike = async (e) => {
    e.stopPropagation();
    try {
      const res = await axios.post(`${BASE_URL}/api/memory/like/${memoryId}`, {}, { withCredentials: true });
      setLikes(res.data.likes);
    } catch (err) {
      console.error("Error liking memory:", err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommenting(true);
    try {
      const res = await axios.post(`${BASE_URL}/api/memory/comment/${memoryId}`, { text: newComment }, { withCredentials: true });
      setMemory(prev => ({
        ...prev,
        comments: [...prev.comments, res.data]
      }));
      setNewComment("");
    } catch (err) {
      console.error("Error adding comment:", err);
    } finally {
      setCommenting(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    } else {
      if (!window.confirm("Delete this memory?")) return;
      axios.delete(`${BASE_URL}/api/memory/deletememory/${memoryId}`, { withCredentials: true })
        .then(() => window.location.reload())
        .catch(console.error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle || !editDesc) return alert("Title and description required");
    try {
      if (onEdit) {
        await onEdit({ _id: memoryId, title: editTitle, description: editDesc });
      } else {
        await axios.patch(`${BASE_URL}/api/memory/editmemory/${memoryId}`, { title: editTitle, description: editDesc }, { withCredentials: true });
      }
      setMemory({ ...memory, title: editTitle, description: editDesc });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to edit:", err);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!memory) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="relative bg-lightMain dark:bg-dlightMain w-full max-w-6xl h-[90vh] md:h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Side: Image */}
        <div className="w-full md:w-1/2 h-[40%] md:h-full relative bg-black flex items-center justify-center border-b md:border-b-0 md:border-r border-dborderColor dark:border-borderColor">
          <img
            src={memory.photoUrl}
            alt={memory.title}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Right Side: Details & Comments */}
        <div className="w-full md:w-1/2 flex flex-col h-[60%] md:h-full">
          {/* Scrollable details and comments */}
          <div className="p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar">
            {isEditing ? (
              <div className="mb-6 space-y-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg p-2 border-[1px] border-dborderColor dark:border-borderColor text-txt dark:text-dtxt bg-lightMain dark:bg-dlightMain focus:outline-none"
                />
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-lg p-2 border-[1px] border-dborderColor dark:border-borderColor text-txt dark:text-dtxt bg-lightMain dark:bg-dlightMain focus:outline-none"
                  rows="3"
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} className="flex-1 bg-green-600 text-white rounded-md py-1">Save</button>
                  <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-500 text-white rounded-md py-1">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl md:text-3xl font-black text-txt dark:text-dtxt mb-4">{memory.title}</h2>
                <p className="text-lightTxt dark:text-dlightTxt text-base md:text-lg mb-6 leading-relaxed bg-main/5 dark:bg-dmain/5 p-4 rounded-xl border-l-4 border-main dark:border-dmain">
                  {memory.description}
                </p>
              </>
            )}

            <div className="flex items-center gap-4 text-sm text-txt/60 dark:text-dtxt/60 mb-6">
              <span className="flex items-center gap-1"><MapPin size={16} />{memory.location?.address}</span>
              <span className="flex items-center gap-1"><Calendar size={16} />{formatDate(memory.createdAt)}</span>
            </div>

            {/* Comments Section */}
            <div>
              <h3 className="text-lg font-bold text-txt dark:text-dtxt mb-4 opacity-70 border-b border-dborderColor dark:border-borderColor pb-2">
                Comments
              </h3>
              <div className="space-y-4">
                {memory.comments?.length > 0 ? (
                  memory.comments.map(comment => (
                    <div key={comment._id} className="flex gap-3 items-start animate-fade-in">
                      <div className="w-8 h-8 rounded-full bg-main/20 overflow-hidden flex-shrink-0">
                        {comment.userId?.profilePic ? (
                          <img src={comment.userId.profilePic} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold uppercase bg-gray-200 dark:bg-gray-700">
                            {comment.userId?.name?.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 bg-dborderColor/10 dark:bg-borderColor/10 p-3 rounded-2xl rounded-tl-none">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-main">{comment.userId?.name}</span>
                          <span className="text-[10px] opacity-40">{new Date(comment.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-txt dark:text-dtxt">{comment.text}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center opacity-40 py-8 italic">No comments yet. Share your thoughts!</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 border-t border-dborderColor dark:border-borderColor bg-lightMain dark:bg-dlightMain flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={handleLike} className="flex items-center gap-1 group">
                  <Heart size={26} className={likes.includes(currentUserId) ? "fill-red-500 text-red-500" : "text-txt dark:text-dtxt group-hover:scale-110 transition"} />
                  <span className="text-txt dark:text-dtxt font-semibold text-lg">{likes.length}</span>
                </button>
              </div>

              {/* Edit / Delete mapping */}
              <div className="flex items-center gap-2">
                {currentUserId === memory.userId && !isEditing && (
                  <>
                    <button onClick={() => setIsEditing(true)} className="text-blue-500 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"><Pencil size={20} /></button>
                    <button onClick={handleDelete} className="text-red-500 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"><Trash size={20} /></button>
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 bg-dborderColor/10 dark:bg-borderColor/10 border border-transparent focus:border-main rounded-full px-4 py-2 text-sm focus:outline-none text-txt dark:text-dtxt"
              />
              <button 
                type="submit" 
                disabled={commenting || !newComment.trim()}
                className="bg-main dark:bg-dmain text-txt dark:text-dtxt p-2 rounded-full hover:scale-105 transition disabled:opacity-30"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostModal;
