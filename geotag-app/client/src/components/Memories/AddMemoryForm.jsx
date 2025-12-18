import { useState, useEffect } from "react";
import axios from "axios";
import { Sparkles } from 'lucide-react';

const AddMemoryForm = ({ onClose, onAdd, position }) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    address: "",
    latitude: "",
    longitude: "",
    photoUrl: "",
  });
  const [addrLoading, setAddrLoading] = useState(false);

  // Auto-fill latitude & longitude from position prop
  useEffect(() => {
    if (position) {
      setFormData((prev) => ({
        ...prev,
        latitude: position.lat,
        longitude: position.lng,
      }));
    }
  }, [position]);

  // Handle input changes
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Reverse geocode function
  const fetchAddress = async () => {
    if (!position || !position.lat || !position.lng) return;

    try {
      setAddrLoading(true);

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        position.lat
      )}&lon=${encodeURIComponent(position.lng)}&accept-language=en`;

      const res = await axios.get(url, {
        headers: {
          "User-Agent": "EchoesGeotagApp/1.0 (your-email@example.com)",
        },
      });

      let finalAddress = "";
      if (res.data && res.data.display_name) {
        const unwantedTerms = [
          "taluka",
          "tehsil",
          "subdivision",
          "ward",
          "zone",
          "suburban",
        ];

        const parts = res.data.display_name.split(",").map((p) => p.trim());
        const seen = new Set();
        const cleaned = [];

        for (let part of parts) {
          const lower = part.toLowerCase();
          const hasUnwantedTerm = unwantedTerms.some((term) =>
            lower.includes(term)
          );
          if (!seen.has(lower) && !hasUnwantedTerm) {
            cleaned.push(part);
            seen.add(lower);
          }
        }

        finalAddress = cleaned.join(", ");
      } else if (res.data && res.data.address) {
        finalAddress = JSON.stringify(res.data.address);
      }

      setFormData((prev) => ({ ...prev, address: finalAddress }));
    } catch (err) {
      console.error(
        "Nominatim reverse geocode error:",
        err.response?.data || err.message || err
      );
      setFormData((prev) => ({ ...prev, address: "" }));
    } finally {
      setAddrLoading(false);
    }
  };


  
  const BASE_URL=import.meta.env.VITE_BASE_URL || "http://localhost:5000";
  const handleSubmit =async (e) => {
    e.preventDefault();

    const newMemory = {
      //userId files will be set later in backend from token cookie(to link user and memory collections(table))
     title: formData.title,
     description: formData.description,
     location: {
       type: "Point", // required for GeoJSON
       coordinates: [
         parseFloat(formData.longitude), // longitude first
         parseFloat(formData.latitude),  // latitude second
       ],
       address: formData.address
     },
     photoUrl: formData.photoUrl,
     createdAt: new Date().toISOString(),
   };
    //optimistic ui update
    onAdd(newMemory);
    onClose();

  try {
    await axios.post(`${BASE_URL}/api/memory/creatememory`, newMemory, { withCredentials: true });
    // optional: you could refresh memory list from backend here
  } catch (err) {
    console.error("Failed to save memory:", err);
    // For now, no rollback — memory stays in UI
    // Later you could implement rollback logic
  }
  };

  return (
    <div className="fixed z-[999] inset-0 backdrop-blur-[10px] bg-dborderColor/50 flex items-center justify-center p-4">
      <div className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-custom overflow-hidden">
        <div className="p-6 bg-main dark:bg-dlightMain">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-txt dark:text-dtxt">
              Add New Memory
            </h2>
            <button
              onClick={onClose}
              className="text-dlightTxt hover:text-txt dark:hover:text-dtxt text-[2rem]"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-lightTxt dark:text-dlightTxt mb-1">
                Title
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                placeholder="Beach Sunset"
                className=" dark:bg-dlightMain w-full px-4 py-2 border-[1px] border-borderColor dark:border-dborderColor rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-lightTxt dark:text-dlightTxt mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows="4"
                placeholder="Describe your memory..."
                className=" dark:bg-dlightMain w-full px-4 py-2 border-[1px] border-borderColor dark:border-dborderColor rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Photo URL */}
            <div>
              <label className="block text-sm font-medium text-lightTxt dark:text-dlightTxt mb-1">
                Photo URL
              </label>
              <input
                type="url"
                name="photoUrl"
                value={formData.photoUrl}
                onChange={handleChange}
                required
                placeholder="https://example.com/photo.jpg"
                className=" dark:bg-dlightMain w-full px-4 py-2 border-[1px] border-borderColor dark:border-dborderColor rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                For now, use image URLs. We'll add file upload later!
              </p>
            </div>

            {/* Address + Auto Address Button */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Santa Monica Beach, CA"
                className="dark:bg-dlightMain w-full px-4 py-2 border-[1px] border-borderColor dark:border-dborderColor rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={fetchAddress}
                className="px-3 py-2 min-w-fit whitespace-nowrap flex text-dtxt text-[1rem] font-bold bg-gradient-main rounded-lg hover:bg-gray-300 text-sm"
              >
                <Sparkles />&nbsp;<p className="flex items-center text-[1.1rem] font-normal ">Auto</p>
              </button>
            </div>

            {/* Info about auto-filled Lat/Lng */}
            <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              Latitude & Longitude are auto-filled based on your map click, but
              you can edit them if needed.
            </div>

            {/* Latitude & Longitude (editable) */}
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                name="latitude"
                value={formData.latitude}
                onChange={(e) =>
                  setFormData({ ...formData, latitude: e.target.value })
                }
                className=" dark:bg-dlightMain w-full px-4 py-2 border-[1px] border-borderColor dark:border-dborderColor rounded-lg text-sm"
              />
              <input
                type="number"
                step="any"
                name="longitude"
                value={formData.longitude}
                onChange={(e) =>
                  setFormData({ ...formData, longitude: e.target.value })
                }
                className=" dark:bg-dlightMain w-full px-4 py-2 border-[1px] border-borderColor dark:border-dborderColor rounded-lg text-sm"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-dmain text-dtxt py-3 rounded-lg font-medium hover:bg-main hover:text-txt transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-dorangeMain via-dpinkMain to-dcyanMain text-white py-3 rounded-lg font-medium transition"
              >
                Add Memory
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddMemoryForm;
