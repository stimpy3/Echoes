import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ImagePlus, X as XIcon } from 'lucide-react';
import TripPicker from './TripPicker';
import { CATEGORY_SELECT_OPTIONS } from '../../lib/categories';

// How long the pin has to sit still before the address auto-fills.
const ADDRESS_AUTOFILL_DELAY = 2000;

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fieldClass =
  "w-full px-[14px] py-[10px] rounded-lg border border-lightMain2 dark:border-[#2b2b2b] bg-slightLightMain dark:bg-[#161616] text-txt dark:text-white text-sm " +
  "placeholder:text-txt2 dark:placeholder:text-[#5a5a5a] focus:outline-none focus-visible:ring-2 focus-visible:ring-dpinkMain/60";

const labelClass = "block text-[11px] font-semibold uppercase tracking-[.12em] text-txt2 dark:text-[#8a8a8a] mb-2";

const AddMemoryForm = ({ onClose, onAdd, position }) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    address: "",
    latitude: "",
    longitude: "",
    photo: null,
    category: "",
    tripId: "",
    // Defaults to today, but editable — a memory's date is when it HAPPENED, which is often
    // not the day it gets uploaded (see memoryDate in server/models/memories.js).
    memoryDate: new Date().toISOString().slice(0, 10),
  });
  const [addrLoading, setAddrLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCoords, setEditingCoords] = useState(false);
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

  // Reverse-geocode automatically once the pin has sat still for a couple of seconds,
  // rather than making the user press a button — every drag/re-click resets the timer, so
  // it only fires once the pin actually settles.
  const addressTimerRef = useRef(null);
  useEffect(() => {
    if (!position?.lat || !position?.lng) return;

    if (addressTimerRef.current) clearTimeout(addressTimerRef.current);
    addressTimerRef.current = setTimeout(() => {
      fetchAddress();
    }, ADDRESS_AUTOFILL_DELAY);

    return () => clearTimeout(addressTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng]);

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
    if (formData.category) data.append('category', formData.category);
    if (formData.tripId) data.append('tripId', formData.tripId);
    if (formData.memoryDate) data.append('memoryDate', formData.memoryDate);

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
        category: formData.category || undefined,
        tripId: formData.tripId || undefined,
        memoryDate: formData.memoryDate || undefined,
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
    <div
      className="fixed z-[1400] top-0 right-0 h-full w-[420px] max-w-full flex flex-col bg-main dark:bg-[#0e0e0e] border-l border-hairline dark:border-dhairline"
      style={{ boxShadow: '-20px 0 48px rgba(0,0,0,.5)' }}
    >
      <div className="h-[3px] w-full bg-gradient-main shrink-0" />

      <div className="h-[64px] shrink-0 flex items-center px-6">
        <h2 className="text-[17px] font-semibold text-txt dark:text-white">New memory</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto text-txt2 dark:text-[#8a8a8a] hover:text-txt dark:hover:text-white"
        >
          <XIcon size={20} />
        </button>
      </div>

      <form id="add-memory-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar px-6 py-2 flex flex-col gap-[18px]">
        <div>
          <label className={labelClass}>Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="Beach Sunset"
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>Your memory</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            style={{ height: 78, lineHeight: 1.55 }}
            placeholder="Start with what you saw, then what you did, and finally how it made you feel...."
            className={fieldClass}
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
          <label className={labelClass}>Photo</label>
          <label
            htmlFor="photo-upload"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center w-full cursor-pointer transition-colors
                        ${photoPreview
                          ? "p-3 rounded-[10px] border border-lightMain2 dark:border-[#2b2b2b] bg-slightLightMain dark:bg-[#161616]"
                          : "px-4 py-8 rounded-xl border-2 border-dashed"}
                        ${!photoPreview && (isDragging
                          ? "border-dpinkMain bg-dpinkMain/10"
                          : "border-lightMain2 dark:border-[#2b2b2b] hover:border-dpinkMain/60")}`}
          >
            {photoPreview ? (
              <div className="w-full flex items-center gap-3">
                <img
                  src={photoPreview}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-txt dark:text-white truncate">
                    {formData.photo?.name}
                  </p>
                  <p className="text-[11.5px] text-txt2 dark:text-[#8a8a8a]">
                    {formData.photo && formatBytes(formData.photo.size)} · Click to replace
                  </p>
                </div>
                <button
                  type="button"
                  // stopPropagation: this button sits inside the <label>, so without it
                  // the click would also activate the file input and reopen the picker.
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearPhoto(); }}
                  aria-label="Remove photo"
                  className="shrink-0 p-2 rounded-full text-txt2 dark:text-[#8a8a8a] hover:text-red-500 hover:bg-red-500/10 transition"
                >
                  <XIcon size={18} />
                </button>
              </div>
            ) : (
              <>
                <ImagePlus className="text-txt2 dark:text-[#5a5a5a] mb-2" size={28} />
                <p className="text-[13.5px] font-medium text-txt dark:text-white">
                  Drop a photo here, or <span className="text-transparent bg-clip-text bg-gradient-main font-bold">browse</span>
                </p>
                <p className="text-[11.5px] text-txt2 dark:text-[#8a8a8a] mt-1">
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
            <p role="alert" className="text-[11.5px] text-[#f87171] mt-2">
              {photoError}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center mb-2">
            <label className={`${labelClass} !mb-0`}>Place</label>
            {addrLoading && (
              <span className="ml-auto text-[10.5px] font-medium normal-case tracking-normal text-accentMain flex items-center gap-1">
                <span className="w-[5px] h-[5px] rounded-full bg-accentMain animate-pulse" />
                Locating…
              </span>
            )}
          </div>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Santa Monica Beach, CA"
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>When</label>
          <input
            type="date"
            name="memoryDate"
            value={formData.memoryDate}
            onChange={handleChange}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className={fieldClass}
          >
            {CATEGORY_SELECT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <TripPicker
          value={formData.tripId}
          onChange={(tripId) => setFormData((prev) => ({ ...prev, tripId }))}
          labelClass={labelClass}
          fieldClass={fieldClass}
        />

        <div>
          <label className={labelClass}>Coordinates</label>
          {editingCoords ? (
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                name="latitude"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                className={`${fieldClass} text-[12.5px]`}
              />
              <input
                type="number"
                step="any"
                name="longitude"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                className={`${fieldClass} text-[12.5px]`}
              />
            </div>
          ) : (
            <div className="flex items-center px-3 py-[9px] rounded-lg bg-slightLightMain dark:bg-[#161616]">
              <span className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-txt2 dark:text-[#5a5a5a] mr-3">Lat / Lng</span>
              <span className="text-[12.5px] text-lightTxt dark:text-[#d0d0d0]" style={{ fontFamily: 'ui-monospace, monospace' }}>
                {formData.latitude || '—'}, {formData.longitude || '—'}
              </span>
              <button
                type="button"
                onClick={() => setEditingCoords(true)}
                className="ml-auto text-[11.5px] font-semibold text-accentMain"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {submitError && (
          <p role="alert" className="text-sm text-[#f87171]">
            {submitError}
          </p>
        )}
      </form>

      <div className="shrink-0 px-6 py-5 border-t border-hairline dark:border-dhairline flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 h-[46px] rounded-[10px] border border-lightMain2 dark:border-[#2b2b2b] text-txt dark:text-white font-medium hover:bg-lightMain dark:hover:bg-white/5 transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="add-memory-form"
          disabled={isSubmitting}
          className="flex-1 h-[46px] rounded-[10px] bg-gradient-mainBright text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Add memory"}
        </button>
      </div>
    </div>
  );
};

export default AddMemoryForm;
