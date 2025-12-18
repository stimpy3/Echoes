import {Pencil,Trash,MapPin,Calendar,ChevronUp,ChevronDown, Download, X} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState,useEffect } from 'react';

const MemoryCard = ({ memory, onDelete, onEdit }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editedMemory, setEditedMemory] = useState(memory);
  const [showDetails, setShowDetails] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false); //Modal state

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleViewOnMap = () => navigate('/home');

  const handleEditClick = () => setIsEditing(true);

  const handleSave = () => {
    if (!editedMemory.title || !editedMemory.description) {
    alert("Title and description are required");
    return;
    }
    onEdit(editedMemory);
    setIsEditing(false);
  };

  const handleDelete = () => {
      onDelete(memory._id);
  };

  //see
  const handleDownload = async () => {
    if (!memory?.photoUrl) return;
    setDownloading(true);

    try {
      const response = await fetch(memory.photoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${memory.title || 'memory'}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading image:', err);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
  if (showImageModal) document.body.style.overflow = 'hidden';
  else document.body.style.overflow = 'auto';
}, [showImageModal]);

  return (
    <>
      {/* --- CARD --- */}
      <div className="relative h-[250px] bg-lightMain dark:bg-dlightMain shadow-md overflow-hidden transition duration-300">
        {/* --- Image --- */}
        <img
          src={memory.photoUrl}
          alt={memory.title}
          onClick={() => !showDetails && setShowImageModal(true)} // open modal only when details hidden
          className={`w-full h-full object-cover cursor-pointer transition-all duration-500 ${
            showDetails ? 'opacity-40 blur-sm' : 'opacity-100 blur-0'
          }`}
        />

        {/* --- Buttons (top layer) --- */}
        <div className="absolute top-3 right-3 flex gap-2 z-20">
          {/* Toggle Chevron */}
          <button onClick={(e) => {
             e.stopPropagation();  // prevent parent onClick
             setShowDetails(!showDetails);
           }}
           className="bg-main/30 dark:bg-dmain/30 backdrop-blur-sm text-txt dark:text-dtxt p-2 rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition"
         >
           {showDetails ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
         </button>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-main/30 dark:bg-dmain/30 backdrop-blur-sm text-txt dark:text-dtxt p-2 rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition"
          >
            <Download size={18} />
          </button>
        </div>

        {/* --- Slide-up Description Sheet --- */}
        <div
          className={`absolute inset-x-0 bottom-0 bg-lightMain dark:bg-dlightMain p-5 rounded-t-lg transform transition-transform duration-500 z-10 ${
            showDetails ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {isEditing ? (
            <>
              <input
                type="text"
                value={editedMemory.title}
                onChange={(e) =>
                  setEditedMemory({ ...editedMemory, title: e.target.value })
                }
                required
                className="w-full mb-2 rounded-lg p-2 border-[1px] border-dborderColor dark:border-borderColor text-txt dark:text-dtxt bg-lightMain dark:bg-dlightMain focus:outline-none"
              />
              <textarea
                value={editedMemory.description}
                onChange={(e) =>
                  setEditedMemory({
                    ...editedMemory,
                    description: e.target.value
                  })
                }
                required
                className="w-full mb-3 rounded-lg p-2 border-[1px] border-dborderColor dark:border-borderColor text-txt dark:text-dtxt bg-lightMain dark:bg-dlightMain focus:outline-none"
                rows="3"
              />
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-txt dark:text-dtxt mb-2">
                {memory.title}
              </h3>
              <p className="text-lightTxt dark:text-dlightTxt mb-4 line-clamp-3">
                {memory.description}
              </p>
            </>
          )}

          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
            <MapPin size={16} className="mr-2" />
            <span>{memory.location.address}</span>
          </div>

          <div className="flex items-center text-sm text-purple-500 mb-4">
            <Calendar size={16} className="mr-2" />
            <span>{formatDate(memory.createdAt)}</span>
          </div>

          {/* --- Actions --- */}
          <div className="flex gap-2">
            {isEditing ? (
              <button
                onClick={handleSave}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
              >
                Save
              </button>
            ) : (
              <button
                onClick={handleViewOnMap}
                className="flex-1 bg-main dark:bg-dmain text-txt dark:text-dtxt py-2 rounded-lg hover:text-dtxt hover:bg-dmain dark:hover:text-txt dark:hover:bg-main transition"
              >
                View on Map
              </button>
            )}

            <button
              onClick={handleEditClick}
              className="px-4 bg-blue-200 text-blue-500 rounded-lg hover:bg-gray-300 transition"
              disabled={isEditing}
            >
              <Pencil />
            </button>

            <button
              onClick={handleDelete}
              className="px-4 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
            >
              <Trash />
            </button>
          </div>
        </div>
      </div>

      {/* --- MODAL FOR IMAGE --- */}
     {showImageModal && (
      <div
        className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-lg flex items-center justify-center p-4"
        onClick={() => setShowImageModal(false)}
      >
        <div
          className="relative h-fit w-fit"
          onClick={(e) => e.stopPropagation()}
        >
          {/*Without stopPropagation, clicking the image would also trigger the parent div’s onClick,
          which closes the modal immediately. */}
          {/* Universal size image */}
          <img
            src={memory.photoUrl}
            alt={memory.title}
            className="w-[50vw] max-w-[800px] object-contain rounded-lg shadow-lg"
          />
    
          {/* Close button */}
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-2 right-2 bg-main dark:bg-dmain text-txt dark:text-dtxt rounded-full p-2 hover:scale-105 transition"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      )}
    </>
  );
};

export default MemoryCard;
