import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import Rail from '../components/Layout/Rail';
import { MobileTopBar, MobileTabBar } from '../components/Layout/MobileNav';
import ContentHeader, { SegmentedPills } from '../components/Layout/ContentHeader';
import MemoryCard from '../components/Memories/MemoryCard';
import TimelineMapView from '../components/Map/TimelineMapView';
import AddToTripSheet from '../components/Trips/AddToTripSheet';
import PostModal from '../components/Memories/PostModal';

/*
One trip, read day by day — the shape that makes this a diary rather than a feed.

Grouping happens HERE, on the client, not in the aggregation. Mongo's $dateToString defaults
to UTC, so a memory made at 02:00 IST would land on the previous UTC day and manufacture a
phantom extra day in the trip. The browser already knows the user's real timezone, for free.
Same reason TimelinePage groups its months client-side.

Dates read `memoryDate ?? createdAt`: createdAt is upload time, which is not when the memory
happened for anything uploaded after the fact.
*/
const dayKey = (m) => new Date(m.memoryDate || m.createdAt).toDateString();

const groupByDay = (memories) => {
  const groups = [];
  const seen = new Map();
  for (const m of memories) {
    const key = dayKey(m);
    if (!seen.has(key)) {
      seen.set(key, { key, date: new Date(m.memoryDate || m.createdAt), memories: [] });
      groups.push(seen.get(key));
    }
    seen.get(key).memories.push(m);
  }
  return groups;
};

const TripDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';

  const fetchTrip = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/trips/${id}`, { withCredentials: true });
      setTrip(res.data.trip);
      setMemories(res.data.memories || []);
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
      else console.error('Error fetching trip:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrip();
  }, [id]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/user/navbar`, { withCredentials: true });
        setCurrentUserId(res.data._id);
      } catch (err) {
        console.error('Error fetching current user:', err);
      }
    };
    fetchUser();
  }, []);

  const handleDeleteTrip = async () => {
    if (!window.confirm('Delete this trip? Your memories are kept — they just stop being grouped.')) return;
    try {
      await axios.delete(`${BASE_URL}/api/trips/${id}`, { withCredentials: true });
      navigate('/trips');
    } catch (err) {
      console.error('Error deleting trip:', err);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen flex bg-main dark:bg-dmain">
        <Rail />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-accentMain" />
        </div>
      </div>
    );
  }

  if (notFound || !trip) {
    return (
      <div className="w-full min-h-screen flex bg-main dark:bg-dmain">
        <Rail />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="text-lg font-semibold text-txt dark:text-dtxt">Trip not found</p>
          <button
            onClick={() => navigate('/trips')}
            className="mt-4 h-[38px] px-5 rounded-full bg-gradient-mainBright text-white text-[13px] font-semibold"
          >
            Back to trips
          </button>
        </div>
      </div>
    );
  }

  const days = groupByDay(memories);
  const range = `${new Date(trip.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(
    trip.endDate
  ).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row bg-main dark:bg-dmain">
      <Rail />
      <MobileTopBar />

      <div className="flex-1 min-w-0 flex flex-col pb-[76px] md:pb-0">
        <ContentHeader
          leading={
            <button
              onClick={() => navigate('/trips')}
              aria-label="Back to trips"
              className="text-txt dark:text-dtxt focus-visible:ring-2 focus-visible:ring-accentMain rounded"
            >
              <ChevronLeft size={24} />
            </button>
          }
          title={trip.title}
          meta={[trip.place, range, `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}`]
            .filter(Boolean)
            .join(' · ')}
          trailing={
            <>
              <SegmentedPills
                options={[
                  { value: 'list', label: 'List' },
                  { value: 'map', label: 'Map' },
                ]}
                value={viewMode}
                onChange={setViewMode}
              />
              <button
                type="button"
                onClick={() => setShowAddSheet(true)}
                className="px-4 h-[38px] rounded-full bg-gradient-mainBright text-white text-[13px] font-semibold flex items-center gap-1.5
                           focus-visible:ring-2 focus-visible:ring-accentMain focus-visible:ring-offset-2"
              >
                <Plus size={15} />
                Add memories
              </button>
              <button
                type="button"
                onClick={handleDeleteTrip}
                aria-label="Delete trip"
                className="w-[38px] h-[38px] rounded-full border border-lightMain2 dark:border-dlightMain2 grid place-content-center text-txt2 dark:text-dtxt2 hover:text-red-500"
              >
                <Trash2 size={15} />
              </button>
            </>
          }
        />

        {memories.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
            <div className="w-14 h-14 rounded-full bg-lightMain dark:bg-dlightMain flex items-center justify-center mb-4">
              <span className="w-5 h-5 rounded-full bg-gradient-main" />
            </div>
            <p className="text-lg font-semibold text-txt dark:text-dtxt">Nothing filed under this trip yet</p>
            <p className="text-sm text-txt2 dark:text-dtxt2 mt-2 max-w-md">
              Add memories you already have, or pick this trip when you create a new one.
            </p>
          </div>
        ) : viewMode === 'map' ? (
          <div className="flex-1 relative min-h-[500px]">
            <TimelineMapView memories={memories} onPinClick={(mid) => setSelectedMemoryId(mid)} />
          </div>
        ) : (
          <div className="p-4 md:p-8 flex flex-col gap-8">
            {days.map((day, i) => (
              <section key={day.key}>
                <h2 className="text-[17px] font-semibold text-txt dark:text-dtxt sticky top-0 bg-main dark:bg-dmain py-2 z-10">
                  Day {i + 1}
                  <span className="text-[12.5px] font-normal text-txt2 dark:text-dtxt2 ml-2">
                    {day.date.toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                  {day.memories.map((memory) => (
                    <MemoryCard key={memory._id} memory={memory} currentUserId={currentUserId} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <MobileTabBar />

      {showAddSheet && (
        <AddToTripSheet trip={trip} onClose={() => setShowAddSheet(false)} onAdded={fetchTrip} />
      )}

      {selectedMemoryId && (
        <PostModal
          memoryId={selectedMemoryId}
          currentUserId={currentUserId}
          onClose={() => setSelectedMemoryId(null)}
        />
      )}
    </div>
  );
};

export default TripDetailPage;
