import { MapPin, Calendar, Heart, Pencil, Trash, Send, X, Route } from 'lucide-react';
import axios from 'axios';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import TripPicker from './TripPicker';
import { CATEGORY_SELECT_OPTIONS } from '../../lib/categories';

const PostModal = ({ memoryId, onClose, currentUserId, onEdit, onDelete }) => {
  const [memory, setMemory] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [likes, setLikes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editTripId, setEditTripId] = useState("");
  const [editDate, setEditDate] = useState("");
  
  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";

  useEffect(() => {
    const fetchMemory = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/memory/single/${memoryId}`, { withCredentials: true });
        setMemory(res.data);
        setLikes(res.data.likes || []);
        setEditTitle(res.data.title);
        setEditDesc(res.data.description);
        setEditCategory(res.data.category || "");
        setEditTripId(res.data.tripId || "");
        // <input type="date"> wants yyyy-mm-dd. memoryDate is when it happened; fall back
        // to createdAt for memories that predate that field.
        setEditDate(new Date(res.data.memoryDate || res.data.createdAt).toISOString().slice(0, 10));
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
    // Sent as a whole so category/trip/date survive an edit — previously only title and
    // description were forwarded, so the rest was silently dropped on every save.
    const payload = {
      _id: memoryId,
      title: editTitle,
      description: editDesc,
      category: editCategory,
      tripId: editTripId,
      memoryDate: editDate,
    };
    try {
      if (onEdit) {
        await onEdit(payload);
      } else {
        await axios.patch(`${BASE_URL}/api/memory/editmemory/${memoryId}`, payload, { withCredentials: true });
      }
      setMemory({
        ...memory,
        title: editTitle,
        description: editDesc,
        category: editCategory || undefined,
        tripId: editTripId || undefined,
        memoryDate: editDate,
      });
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

  // Escape to close — the modal previously only closed by clicking the backdrop, which on
  // mobile is a p-4 sliver around the edges and easy to miss entirely.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /*
  `memory.userId` is POPULATED by GET /api/memory/single/:id (.populate('userId', ...)),
  so it's an object like { _id, name, profilePic } — not an id string.

  The old check was `currentUserId === memory.userId`, comparing a string to an object,
  which is always false. That meant the Edit and Delete buttons never rendered, even on
  your own memories. Comparing against ._id (and stringifying, since ObjectIds serialize
  to strings over JSON but it costs nothing to be explicit) is the actual test.
  */
  const isOwner =
    !!memory && String(memory.userId?._id ?? memory.userId) === String(currentUserId);

  // Skeleton rather than `return null` — clicking a post used to render nothing at all
  // until the fetch resolved, so on a slow connection the click appeared to do nothing.
  if (!memory) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-6xl h-[90vh] md:h-[85vh] rounded-2xl overflow-hidden flex flex-col md:flex-row bg-lightMain dark:bg-dlightMain">
          <div className="w-full md:w-1/2 h-[40%] md:h-full bg-black/20 dark:bg-white/5 animate-pulse" />
          <div className="w-full md:w-1/2 p-6 space-y-4">
            <div className="h-8 w-2/3 rounded-lg bg-black/10 dark:bg-white/10 animate-pulse" />
            <div className="h-24 w-full rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="relative bg-lightMain dark:bg-dlightMain w-full max-w-6xl h-[90vh] md:h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Side: Image.

            The blank space: `object-contain` preserves the photo's aspect ratio, so a
            portrait photo in this landscape-ish half left thick black bars either side
            (and a landscape one left them top and bottom). Switching to object-cover would
            fill it but crop the photo — bad for a memory, where the framing is the point.

            Instead the gap is filled with a blurred, over-scaled copy of the same image
            behind the real one. The photo is still shown complete and uncropped; the dead
            space becomes an ambient wash of its own colours. scale-110 hides the soft
            transparent edges blur leaves behind. */}
        <div className="w-full md:w-1/2 h-[45%] md:h-full relative overflow-hidden bg-black flex items-center justify-center border-b md:border-b-0 md:border-r border-dborderColor dark:border-borderColor">
          <img
            src={memory.photoUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
          />
          <img
            src={memory.photoUrl}
            alt={memory.title}
            className="relative z-10 w-full h-full object-contain"
          />

          {/* Close button — there wasn't one. Backdrop-click was the only way out, and on
              mobile that's a 16px border around the sheet. */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute z-20 top-3 right-3 p-2 rounded-full bg-black/50 text-white backdrop-blur-md
                       hover:bg-black/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X size={18} />
          </button>
        </div>

        {/* Right Side: Details & Comments */}
        <div className="w-full md:w-1/2 flex flex-col h-[55%] md:h-full">
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
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-lg p-2 border-[1px] border-dborderColor dark:border-borderColor text-txt dark:text-dtxt bg-lightMain dark:bg-dlightMain focus:outline-none text-sm"
                />
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full rounded-lg p-2 border-[1px] border-dborderColor dark:border-borderColor text-txt dark:text-dtxt bg-lightMain dark:bg-dlightMain focus:outline-none text-sm"
                >
                  {CATEGORY_SELECT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <TripPicker
                  value={editTripId}
                  onChange={setEditTripId}
                  labelClass="block text-[11px] font-semibold uppercase tracking-[.12em] text-txt2 dark:text-dtxt2 mb-2"
                  fieldClass="w-full rounded-lg p-2 border-[1px] border-dborderColor dark:border-borderColor text-txt dark:text-dtxt bg-lightMain dark:bg-dlightMain focus:outline-none text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} className="flex-1 bg-green-600 text-white rounded-md py-1">Save</button>
                  <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-500 text-white rounded-md py-1">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {/* Author — the API already populates userId with name + profilePic, but
                    the modal never showed who posted it. Obvious from your own diary, not
                    obvious at all when the same modal opens from someone else's profile. */}
                {memory.userId?.name && (
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-black/10 dark:bg-white/10 shrink-0">
                      {memory.userId.profilePic ? (
                        <img src={memory.userId.profilePic} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-bold uppercase text-txt dark:text-dtxt">
                          {memory.userId.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-txt dark:text-dtxt">
                      {memory.userId.name}
                    </span>
                  </div>
                )}

                <h2 className="text-2xl md:text-3xl font-black text-txt dark:text-dtxt mb-4 leading-tight">
                  {memory.title}
                </h2>

                {/* The accent bar and background here were previously `border-main` /
                    `bg-main/5` — and `main` is literally `white`. White-on-light in light
                    mode, and `dark:border-dmain` is black-on-#222 in dark mode, so this
                    card was invisible in BOTH themes. Neutral tint + the app's accent
                    colour makes it actually read as a quote block. */}
                <p className="text-lightTxt dark:text-dlightTxt text-base md:text-lg mb-6 leading-relaxed bg-black/[0.03] dark:bg-white/[0.04] p-4 rounded-xl border-l-4 border-accentMain whitespace-pre-wrap">
                  {memory.description}
                </p>
              </>
            )}

            {/* flex-wrap + items-start + shrink-0 icons: a long address previously forced
                this row to overflow, squashing the date off the edge. Now it wraps. */}
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2 text-sm text-txt/60 dark:text-dtxt/60 mb-6">
              {memory.location?.address && (
                <span className="flex items-start gap-1.5 min-w-0">
                  <MapPin size={16} className="shrink-0 mt-0.5" />
                  <span className="break-words">{memory.location.address}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5 shrink-0">
                <Calendar size={16} className="shrink-0" />
                {/* When it happened, not when it was uploaded — see memoryDate on the Memory model. */}
                {formatDate(memory.memoryDate || memory.createdAt)}
              </span>
              {memory.category && (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-slightLightMain dark:bg-[#1c1c1c] text-[11px] font-semibold uppercase tracking-[.06em]">
                  {memory.category}
                </span>
              )}
              {memory.tripId && (
                <Link
                  to={`/trips/${memory.tripId}`}
                  onClick={onClose}
                  className="shrink-0 flex items-center gap-1.5 text-accentMain font-semibold hover:underline"
                >
                  <Route size={15} className="shrink-0" />
                  View trip
                </Link>
              )}
            </div>

            {/* Comments Section */}
            <div>
              <h3 className="text-lg font-bold text-txt dark:text-dtxt mb-4 opacity-70 border-b border-black/10 dark:border-white/10 pb-2">
                Comments
                {memory.comments?.length > 0 && (
                  <span className="ml-2 text-sm font-medium opacity-60">
                    {memory.comments.length}
                  </span>
                )}
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
                      <div className="flex-1 min-w-0 bg-black/[0.04] dark:bg-white/[0.06] p-3 rounded-2xl rounded-tl-none">
                        <div className="flex justify-between items-center gap-2 mb-1">
                          {/* Was `text-main` — and `main` is `white`, so comment author
                              names rendered white on a near-white bubble in light mode:
                              invisible. Uses the normal text token now. */}
                          <span className="text-xs font-bold text-txt dark:text-dtxt truncate">
                            {comment.userId?.name}
                          </span>
                          <span className="text-[10px] opacity-40 shrink-0">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-txt dark:text-dtxt break-words">{comment.text}</p>
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
          <div className="p-4 border-t border-black/10 dark:border-white/10 bg-lightMain dark:bg-dlightMain flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleLike}
                  aria-label={likes.includes(currentUserId) ? "Unlike" : "Like"}
                  aria-pressed={likes.includes(currentUserId)}
                  className="flex items-center gap-1.5 group"
                >
                  <Heart
                    size={26}
                    className={`transition ${likes.includes(currentUserId)
                      ? "fill-red-500 text-red-500"
                      : "text-txt dark:text-dtxt group-hover:scale-110"}`}
                  />
                  <span className="text-txt dark:text-dtxt font-semibold text-lg">{likes.length}</span>
                </button>
              </div>

              {/* Edit / Delete — gated on `isOwner`, which compares against
                  memory.userId._id. The previous `currentUserId === memory.userId` compared
                  a string to the populated user OBJECT, so it was always false and these
                  never rendered on your own memories. */}
              <div className="flex items-center gap-2">
                {isOwner && !isEditing && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      aria-label="Edit memory"
                      className="text-blue-500 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
                    >
                      <Pencil size={20} />
                    </button>
                    <button
                      onClick={handleDelete}
                      aria-label="Delete memory"
                      className="text-red-500 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
                    >
                      <Trash size={20} />
                    </button>
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
                className="flex-1 min-w-0 bg-black/[0.04] dark:bg-white/[0.06] border border-transparent
                           focus:outline-none focus-visible:border-accentMain rounded-full px-4 py-2 text-sm
                           text-txt dark:text-dtxt placeholder:text-txt/40 dark:placeholder:text-dtxt/40"
              />
              <button
                type="submit"
                disabled={commenting || !newComment.trim()}
                aria-label="Post comment"
                className="shrink-0 bg-gradient-mainBright text-white p-2.5 rounded-full hover:brightness-110
                           transition disabled:opacity-30 disabled:hover:brightness-100"
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
