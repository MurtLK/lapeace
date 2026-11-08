import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { ResearchDashboard } from './pages/ResearchDashboard';
import { HomePage } from './pages/HomePage';

export function App() {
  const location = useLocation();
  useEffect(() => {
    document.title = location.pathname === '/dashboard' ? 'Dashboard | LaPeace' : 'LaPeace | Speech recognition and accented English';
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView?.({ block: 'start' });
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<ResearchDashboard />} />
      <Route path="*" element={<main className="app-not-found"><h1>This page isn’t here.</h1><p>Return to LAPEACE to explore the project.</p><Link to="/">Back to website</Link></main>} />
    </Routes>
  );
}
