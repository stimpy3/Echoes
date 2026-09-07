import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HomeLocationPage from './pages/HomeLocationPage'
import MemoriesPage from './pages/MemoriesPage';
import FollowerListPage from './pages/FollowerListPage';
import FollowingListPage from './pages/FollowingListPage';
import TimelinePage from './pages/TimelinePage';
import ChatPage from "./pages/ChatPage";
import AuthPage from './pages/auth/AuthPage';
import LandingPage from './pages/LandingPage';
import ProfilePage from "./pages/ProfilePage";
import SearchPage from './pages/SearchPage';
import TripsPage from './pages/TripsPage';
import TripDetailPage from './pages/TripDetailPage';
import CoPresenceMatchesPage from './pages/CoPresenceMatchesPage';
import { ThemeProvider } from "./context/ThemeContext";
import { HomeProvider } from "./context/HomeContext";

function App() {
  return (
    <ThemeProvider>
    <HomeProvider>
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center">
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/homelocation" element={<HomeLocationPage />} />
          <Route path="/profile" element={<MemoriesPage />} />
          <Route path="/followers" element={<FollowerListPage />} />
          <Route path="/following" element={<FollowingListPage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />
          {/* Explore was removed with the pivot to a private diary; keep old links working. */}
          <Route path="/explore" element={<Navigate to="/search" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/copresence" element={<CoPresenceMatchesPage />} />
          {/* The public landing page is the front door; auth moved to /auth. */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </div>
    </Router>
    </HomeProvider>
    </ThemeProvider>
  );
}

export default App;