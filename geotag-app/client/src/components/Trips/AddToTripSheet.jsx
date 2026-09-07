import { useState, useEffect } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

/*
Bulk-files existing memories into a trip.

Anything whose date falls inside the trip's own [startDate, endDate] is pre-checked. That is
where the value of "auto-suggest which memories belong to this trip" actually lives: the trip
already declares its date range, so this is a range check rather than a clustering problem —
no background job, no new failure mode, and a human still confirms every assignment before
anything is written.

Only trip-less memories are offered. Moving a memory between trips is done from the memory
itself, so this sheet can't silently steal entries out of another trip.
*/
const AddToTripSheet = ({ trip, onClose, onAdded }) => {
  const [memories, setMemories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchLoose = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/memory/fetchmemory`, { withCredentials: true });
        const loose = (res.data.memories || []).filter((m) => !m.tripId);
        setMemories(loose);

        // Pre-check by date — read memoryDate first, since createdAt is upload time.
        const start = new Date(trip.startDate).setHours(0, 0, 0, 0);
        const end = new Date(trip.endDate).setHours(23, 59, 59, 999);
        const inRange = loose.filter((m) => {
          const when = new Date(m.memoryDate || m.createdAt).getTime();
          return when >= start && when <= end;
        });
        setSelected(new Set(inRange.map((m) => m._id)));
      } catch (err) {
        console.error('Error fetching memories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLoose();
  }, [trip._id]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setError('');
    try {
      await axios.post(
        `${BASE_URL}/api/trips/${trip._id}/memories`,
        { memoryIds: [...selected] },
        { withCredentials: true }
      );
      onAdded();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't add those memories.");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1300]" onClick={onClose} />
      <div className="fixed z-[1400] top-0 right-0 h-full w-[420px] max-w-full flex flex-col bg-main dark:bg-[#0e0e0e] border-l border-hairline dark:border-dhairline shadow-add-panel">
        <div className="h-[3px] w-full bg-gradient-main shrink-0" />

        <div className="h-[64px] shrink-0 flex items-center px-6">
          <h2 className="text-[17px] font-semibold text-txt dark:text-white">Add memories</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto text-txt2 dark:text-[#8a8a8a] hover:text-txt dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <p className="px-6 pb-3 text-[12.5px] text-txt2 dark:text-dtxt2">
          Memories from {new Date(trip.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          {' – '}
          {new Date(trip.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} are ticked already.
        </p>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <p className="px-6 py-4 text-[12.5px] text-txt2 dark:text-dtxt2">Loading…</p>
          ) : memories.length === 0 ? (
            <p className="px-6 py-4 text-[12.5px] text-txt2 dark:text-dtxt2">
              Every memory is already filed under a trip.
            </p>
          ) : (
            memories.map((m) => {
              const isOn = selected.has(m._id);
              return (
                <label
                  key={m._id}
                  className={`flex items-center gap-3 px-6 py-3 cursor-pointer border-b border-hairline dark:border-[#1c1c1c] ${
                    isOn ? 'bg-lightMain dark:bg-[#1a1a1a]' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isOn}
                    onChange={() => toggle(m._id)}
                  />
                  <span
                    className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0"
                    style={
                      isOn
                        ? { background: 'linear-gradient(45deg,#fc9b41,#d557e3,#3ed8e3)' }
                        : { border: '1.5px solid #c9c5bd' }
                    }
                  >
                    {isOn && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <img src={m.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-txt dark:text-dtxt truncate">{m.title}</span>
                    <span className="block text-[11.5px] text-txt2 dark:text-dtxt2">
                      {new Date(m.memoryDate || m.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        {error && (
          <p role="alert" className="px-6 py-2 text-[11.5px] text-[#f87171]">
            {error}
          </p>
        )}

        <div className="shrink-0 px-6 py-5 border-t border-hairline dark:border-dhairline flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-[46px] rounded-[10px] border border-lightMain2 dark:border-[#2b2b2b] text-txt dark:text-white font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || selected.size === 0}
            className="flex-1 h-[46px] rounded-[10px] bg-gradient-mainBright text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Adding…' : `Add ${selected.size}`}
          </button>
        </div>
      </div>
    </>
  );
};

export default AddToTripSheet;
