import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Plus, Images } from 'lucide-react';
import Rail from '../components/Layout/Rail';
import { MobileTopBar, MobileTabBar } from '../components/Layout/MobileNav';
import ContentHeader, { SegmentedPills } from '../components/Layout/ContentHeader';

/*
The Trips half of the Diary. A trip is a journey — "Goa, 12–15 Mar" — that a set of memories
belongs to, so the diary reads as a record of trips rather than a flat wall of posts.

Memories in no trip at all are not an edge case: every memory created before trips existed is
in that state, and filing one is always optional. They get a pinned card of their own so they
stay reachable rather than quietly disappearing from this view.
*/
const formatRange = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const opts = { day: 'numeric', month: 'short' };
  if (sameMonth) {
    return `${s.getDate()}–${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
  }
  return `${s.toLocaleDateString('en-GB', opts)} – ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
};

const TripsPage = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [looseCount, setLooseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', place: '', startDate: '', endDate: '' });
  const [saveError, setSaveError] = useState('');

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';

  const fetchTrips = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/trips`, { withCredentials: true });
      setTrips(res.data.trips || []);
      setLooseCount(res.data.looseCount || 0);
    } catch (err) {
      console.error('Error fetching trips:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaveError('');
    try {
      const res = await axios.post(`${BASE_URL}/api/trips`, draft, { withCredentials: true });
      setCreating(false);
      setDraft({ title: '', place: '', startDate: '', endDate: '' });
      navigate(`/trips/${res.data.trip._id}`);
    } catch (err) {
      setSaveError(err.response?.data?.message || "Couldn't create that trip.");
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row bg-main dark:bg-dmain">
      <Rail />
      <MobileTopBar />

      <div className="flex-1 min-w-0 flex flex-col pb-[76px] md:pb-0">
        <ContentHeader
          title="Diary"
          meta={`${trips.length} trip${trips.length === 1 ? '' : 's'}`}
          trailing={
            <>
              <SegmentedPills
                options={[
                  { value: 'timeline', label: 'Timeline' },
                  { value: 'trips', label: 'Trips' },
                ]}
                value="trips"
                onChange={(v) => v === 'timeline' && navigate('/timeline')}
              />
              <button
                type="button"
                onClick={() => setCreating((v) => !v)}
                className="px-4 h-[38px] rounded-full bg-gradient-mainBright text-white text-[13px] font-semibold flex items-center gap-1.5
                           focus-visible:ring-2 focus-visible:ring-accentMain focus-visible:ring-offset-2"
              >
                <Plus size={15} />
                New trip
              </button>
            </>
          }
        />

        {creating && (
          <form
            onSubmit={handleCreate}
            className="mx-8 mt-6 p-6 rounded-xl border border-hairline dark:border-dhairline flex flex-col gap-3"
          >
            <div className="flex flex-col md:flex-row gap-3">
              <input
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Trip name — e.g. Goa"
                className="flex-1 px-[14px] py-[10px] rounded-lg border border-lightMain2 dark:border-[#2b2b2b] bg-slightLightMain dark:bg-[#161616] text-txt dark:text-dtxt text-sm outline-none focus-visible:ring-2 focus-visible:ring-accentMain"
              />
              <input
                value={draft.place}
                onChange={(e) => setDraft({ ...draft, place: e.target.value })}
                placeholder="Where — e.g. Goa, India"
                className="flex-1 px-[14px] py-[10px] rounded-lg border border-lightMain2 dark:border-[#2b2b2b] bg-slightLightMain dark:bg-[#161616] text-txt dark:text-dtxt text-sm outline-none focus-visible:ring-2 focus-visible:ring-accentMain"
              />
            </div>
            <div className="flex gap-3">
              <input
                required
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                className="flex-1 px-[14px] py-[10px] rounded-lg border border-lightMain2 dark:border-[#2b2b2b] bg-slightLightMain dark:bg-[#161616] text-txt dark:text-dtxt text-[12.5px] outline-none"
              />
              <input
                required
                type="date"
                value={draft.endDate}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                className="flex-1 px-[14px] py-[10px] rounded-lg border border-lightMain2 dark:border-[#2b2b2b] bg-slightLightMain dark:bg-[#161616] text-txt dark:text-dtxt text-[12.5px] outline-none"
              />
            </div>
            {saveError && (
              <p role="alert" className="text-[12.5px] text-[#f87171]">
                {saveError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="h-[42px] px-5 rounded-full border border-lightMain2 dark:border-dlightMain2 text-txt dark:text-dtxt text-[13px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-[42px] px-5 rounded-full bg-gradient-mainBright text-white text-[13px] font-semibold"
              >
                Create trip
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-accentMain" />
          </div>
        ) : trips.length === 0 && looseCount === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 rounded-full bg-lightMain dark:bg-dlightMain flex items-center justify-center mb-4">
              <span className="w-5 h-5 rounded-full bg-gradient-main" />
            </div>
            <p className="text-lg font-semibold text-txt dark:text-dtxt">No trips yet</p>
            <p className="text-sm text-txt2 dark:text-dtxt2 mt-2 max-w-md">
              A trip groups the memories from one journey, so your diary reads day by day
              instead of as one long list.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 md:p-8">
            {/* Pinned first: memories that belong to no trip. */}
            <button
              type="button"
              onClick={() => navigate('/timeline')}
              className="text-left rounded-xl border border-dashed border-lightMain2 dark:border-dlightMain2 overflow-hidden
                         focus-visible:ring-2 focus-visible:ring-accentMain"
            >
              <div className="h-[170px] flex items-center justify-center bg-slightLightMain dark:bg-[#131313]">
                <Images size={28} className="text-txt2 dark:text-dtxt2" />
              </div>
              <div className="px-3 pt-[10px] pb-3">
                <p className="text-sm font-semibold text-txt dark:text-dtxt">Not in a trip</p>
                <p className="text-xs text-txt2 dark:text-dtxt2 mt-0.5">
                  {looseCount} {looseCount === 1 ? 'memory' : 'memories'}
                </p>
              </div>
            </button>

            {trips.map((trip) => (
              <button
                key={trip._id}
                type="button"
                onClick={() => navigate(`/trips/${trip._id}`)}
                className="text-left rounded-xl border border-hairline dark:border-dhairline overflow-hidden
                           focus-visible:ring-2 focus-visible:ring-accentMain"
              >
                <div className="h-[170px] bg-lightMain dark:bg-dlightMain">
                  {trip.coverPhotoUrl ? (
                    <img src={trip.coverPhotoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MapPin size={26} className="text-txt2 dark:text-dtxt2" />
                    </div>
                  )}
                </div>
                <div className="px-3 pt-[10px] pb-3">
                  <p className="text-sm font-semibold text-txt dark:text-dtxt truncate">{trip.title}</p>
                  <p className="text-xs text-txt2 dark:text-dtxt2 truncate mt-0.5">
                    {[trip.place, formatRange(trip.startDate, trip.endDate)].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xs text-txt2 dark:text-dtxt2 mt-0.5">
                    {trip.memoryCount} {trip.memoryCount === 1 ? 'memory' : 'memories'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <MobileTabBar />
    </div>
  );
};

export default TripsPage;
