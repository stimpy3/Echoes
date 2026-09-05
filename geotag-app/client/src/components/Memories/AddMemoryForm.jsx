import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Sparkles, ImagePlus, X as XIcon } from 'lucide-react';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AddMemoryForm = ({ onClose, onAdd, position }) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    address: "",
    latitude: "",
    longitude: "",
    photo: null,
  });
  const [addrLoading, setAddrLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  /*
  Object URLs are not garbage collected — the browser holds the blob alive until the URL is
  explicitly revoked. Without this, picking a different photo several times in one session
  leaks every previous image. Revoking on change AND on unmount covers both paths.
  */
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

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

  /*
  Single place that accepts a File, whether it arrived via the file picker or a drop.
  Validation happens here rather than only on submit so a wrong file is rejected the moment
  it's chosen, next to the control — instead of after the user has filled in the whole form
  and hit Add. Type is re-checked even though the input has `accept=`, because `accept` only
  filters the picker dialog; it doesn't apply to drag-and-drop at all.
  */
  const acceptPhoto = (file) => {
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setPhotoError("That file type isn't supported. Use PNG or JPEG.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError(`That image is ${formatBytes(file.size)}. Maximum is ${formatBytes(MAX_PHOTO_BYTES)}.`);
      return;
    }

    setPhotoError("");
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setFormData((prev) => ({ ...prev, photo: file }));
  };

  const handleFileChange = (e) => acceptPhoto(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    acceptPhoto(e.dataTransfer.files?.[0]);
  };

  const clearPhoto = () => {
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFormData((prev) => ({ ...prev, photo: null }));
    setPhotoError("");
    // Reset the native input too, or re-picking the SAME file fires no change event
    // (the value is unchanged) and the photo would appear not to come back.
    if (fileInputRef.current) fileInputRef.current.value = "";
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



  const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Inline error instead of alert(): a native alert is modal, dismissible only by
    // clicking OK, and appears detached from the field that caused it. Also, `required`
    // was removed from the (now visually hidden) input — a hidden required control makes
    // the browser refuse to submit with an unfocusable-control error rather than showing
    // a useful message, so validation is owned here instead.
    if (!formData.photo) {
      setPhotoError("Add a photo to save this memory.");
      return;
    }

    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('location', JSON.stringify({
      type: "Point",
      coordinates: [
        parseFloat(formData.longitude), // longitude first
        parseFloat(formData.latitude),  // latitude second
      ],
      address: formData.address
    }));
    data.append('photo', formData.photo);

    setSubmitError("");
    setIsSubmitting(true);

    // BE-006 fix: this used to call onAdd()/onClose() BEFORE the request below had even
    // been sent, then only console.error'd on failure — a rejected memory (e.g. the
    // blank-address 500, now a 400) still looked like it saved, and the user was never
    // told. Wait for the real response and only update the UI once it actually succeeds.
    try {
      const res = await axios.post(`${BASE_URL}/api/memory/creatememory`, data, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const newMemory = res.data?.memory ?? {
        title: formData.title,
        description: formData.description,
        location: {
          type: "Point",
          coordinates: [
            parseFloat(formData.longitude),
            parseFloat(formData.latitude),
          ],
          address: formData.address
        },
        photoUrl: URL.createObjectURL(formData.photo),
        createdAt: new Date().toISOString(),
      };

      onAdd(newMemory);
      onClose();
    } catch (err) {
      console.error("Failed to save memory:", err);
      setSubmitError(err.response?.data?.message || "Couldn't save this memory. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed z-[999] inset-0 backdrop-blur-[10px] bg-dborderColor/50 flex items-center justify-center p-4">
      {/* rounded-xl + overflow-hidden on the OUTER box so the rounded corners clip the
          scrolling content; the inner div owns the scroll. Previously both overflow-y-auto
          and overflow-hidden sat on the same element — the y-axis still scrolled (the
          later rule wins) but it's ambiguous, and the scrollbar rendered against a square
          corner. Splitting the two responsibilities makes it explicit. */}
      <div className="rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 bg-main dark:bg-dlightMain overflow-y-auto custom-scrollbar">
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
                className=" dark:bg-dlightMain w-full px-4 py-2 border-[1px] border-borderColor dark:border-dborderColor rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-dpinkMain/60"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-lightTxt dark:text-dlightTxt mb-1">
                Your memory
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows="4"
                placeholder="Start with what you saw, then what you did, and finally how it made you feel...."
                className=" dark:bg-dlightMain w-full px-4 py-2 border-[1px] border-borderColor dark:border-dborderColor rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-dpinkMain/60"
              />
            </div>

            {/* Photo Selection — dropzone.
                The native <input type="file"> is kept in the DOM (it's still what actually
                holds the file and opens the picker) but visually hidden via sr-only rather
                than `hidden`/`display:none`, because a display:none input can't receive
                focus — which breaks keyboard access and browser validation messages.
                The <label> is the visible target: clicking or pressing Enter/Space on it
                activates the input natively, no JS click-forwarding needed. */}
            <div>
              <label
                htmlFor="photo-upload"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center w-full rounded-xl
                            border-2 border-dashed cursor-pointer transition-colors
                            ${photoPreview ? "p-3" : "px-4 py-8"}
                            ${isDragging
                              ? "border-dpinkMain bg-dpinkMain/10"
                              : "border-borderColor dark:border-dborderColor hover:border-dpinkMain/60"}`}
              >
                {photoPreview ? (
                  <div className="w-full flex items-center gap-3">
                    <img
                      src={photoPreview}
                      alt=""
                      className="w-20 h-20 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-txt dark:text-dtxt truncate">
                        {formData.photo?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formData.photo && formatBytes(formData.photo.size)} · Click to replace
                      </p>
                    </div>
                    <button
                      type="button"
                      // stopPropagation: this button sits inside the <label>, so without it
                      // the click would also activate the file input and reopen the picker.
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearPhoto(); }}
                      aria-label="Remove photo"
                      className="shrink-0 p-2 rounded-full text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition"
                    >
                      <XIcon size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <ImagePlus className="text-gray-400 mb-2" size={28} />
                    <p className="text-sm font-medium text-txt dark:text-dtxt">
                      Drop a photo here, or <span className="text-transparent bg-clip-text bg-gradient-main font-semibold">browse</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG or JPEG, up to {formatBytes(MAX_PHOTO_BYTES)}
                    </p>
                  </>
                )}

                <input
                  id="photo-upload"
                  ref={fileInputRef}
                  type="file"
                  name="photo"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>

              {photoError && (
                <p role="alert" className="text-xs text-red-500 mt-2">
                  {photoError}
                </p>
              )}
            </div>

            {/* Address + Auto Address Button */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Santa Monica Beach, CA"
                className="dark:bg-dlightMain w-full px-4 py-2 border-[1px] border-borderColor dark:border-dborderColor rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-dpinkMain/60"
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

            {submitError && (
              <p role="alert" className="text-sm text-red-500">
                {submitError}
              </p>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 bg-dmain text-dtxt py-3 rounded-lg font-medium hover:bg-main hover:text-txt transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-dorangeMain via-dpinkMain to-dcyanMain text-white py-3 rounded-lg font-medium transition disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Add Memory"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddMemoryForm;
