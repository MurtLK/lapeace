import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { HomePage } from './pages/HomePage';

export function App() {
  const location = useLocation();
  useEffect(() => {
    document.title = 'LaPeace | Speech recognition and accented English';
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<main className="app-not-found"><h1>This page isn’t here.</h1><p>Return to LAPEACE to explore the project.</p><Link to="/">Back to website</Link></main>} />
    </Routes>
  );
}
