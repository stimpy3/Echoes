import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HomeLocationPage from './pages/HomeLocationPage'
import MemoriesPage from './pages/MemoriesPage';
import TimelinePage from './pages/TimelinePage';
import AnalyticsPage from './pages/AnalyticsPage'
import AuthPage from './pages/auth/AuthPage';
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
          <Route path="/timeline" element={<TimelinePage />} />
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