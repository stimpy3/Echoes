import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus } from 'lucide-react';

/*
Files a memory under a trip, with an inline "create a new one" path so the user never has to
leave the form they're in to make the trip first.

Value is the trip's id, or '' for "not in a trip" — which is a legitimate, common state, not an
unset placeholder. Most memories belong to no trip.
*/
const TripPicker = ({ value, onChange, labelClass, fieldClass }) => {
  const [trips, setTrips] = useState([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/trips`, { withCredentials: true });
        setTrips(res.data.trips || []);
      } catch (err) {
        console.error('Error fetching trips:', err);
      }
    };
    fetchTrips();
  }, []);

  const handleCreate = async () => {
    if (!draft.title || !draft.startDate || !draft.endDate) {
      setError('A trip needs a name and both dates.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await axios.post(`${BASE_URL}/api/trips`, draft, { withCredentials: true });
      const trip = res.data.trip;
      setTrips((prev) => [trip, ...prev]);
      onChange(trip._id); // file this memory under the trip that was just made
      setCreating(false);
      setDraft({ title: '', startDate: '', endDate: '' });
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create that trip.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label className={labelClass}>Trip</label>

      {!creating ? (
        <div className="flex items-center gap-2">
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`${fieldClass} flex-1`}
          >
            <option value="">Not in a trip</option>
            {trips.map((t) => (
              <option key={t._id} value={t._id}>
                {t.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="h-[42px] px-3 rounded-lg border border-lightMain2 dark:border-[#2b2b2b] text-txt dark:text-white text-[13px] font-medium flex items-center gap-1 shrink-0
                       focus-visible:ring-2 focus-visible:ring-accentMain"
          >
            <Plus size={15} />
            New
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-lightMain2 dark:border-[#2b2b2b] p-3 flex flex-col gap-2">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Goa"
            className={fieldClass}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              className={`${fieldClass} text-[12.5px]`}
            />
            <input
              type="date"
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              className={`${fieldClass} text-[12.5px]`}
            />
          </div>
          {error && (
            <p role="alert" className="text-[11.5px] text-[#f87171]">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError('');
              }}
              className="flex-1 h-[38px] rounded-lg border border-lightMain2 dark:border-[#2b2b2b] text-txt dark:text-white text-[13px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 h-[38px] rounded-lg bg-gradient-mainBright text-white text-[13px] font-semibold disabled:opacity-60"
            >
              {saving ? 'Creating…' : 'Create trip'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripPicker;
