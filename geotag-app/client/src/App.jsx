import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HomeLocationPage from './pages/HomeLocationPage'
import MemoriesPage from './pages/MemoriesPage';
import FollowerListPage from './pages/FollowerListPage';
import FollowingListPage from './pages/FollowingListPage';
import TimelinePage from './pages/TimelinePage';
import AnalyticsPage from './pages/AnalyticsPage';
import ChatPage from "./pages/ChatPage";
import AuthPage from './pages/auth/AuthPage';
import ProfilePage from "./pages/ProfilePage";
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
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/" element={<AuthPage />} />
        </Routes>
      </div>
    </Router>
    </HomeProvider>
    </ThemeProvider>
  );
}

export default App;