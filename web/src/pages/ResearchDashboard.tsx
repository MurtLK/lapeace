import { useEffect } from 'react';
import { openDashboard } from '../lib/navigation';
import { Link, useLocation } from 'react-router-dom';
import './research-dashboard.css';

export function ResearchDashboard() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const url = new URL('/dashboard-app/index.html', window.location.origin);
  const backend = params.get('backend') || import.meta.env.VITE_API_BASE_URL;
  if (backend) {
    try {
      const parsed = new URL(backend);
      if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password) {
        url.searchParams.set('backend', parsed.href.replace(/\/$/, ''));
      }
    } catch { /* Invalid configuration falls back to the same-origin proxy. */ }
  }
  const tab = params.get('tab');
  if (tab === 'community' || tab === 'where') url.hash = 'where';
  if (tab && ['overview', 'clips', 'review', 'settings', 'languages', 'callcheck'].includes(tab)) url.hash = tab;
  const src = `${url.pathname}${url.search}${url.hash}`;

  useEffect(() => { openDashboard(src); }, [src]);
  return (
    <main className="research-dashboard-launch">
      <h1>Opening the dashboard...</h1>
      <p>The research workspace opens as a full page.</p>
      <a href={src}>Open dashboard</a>
      <Link to="/">Back to website</Link>
      <Link to="/#dashboard-guide">Dashboard guide</Link>
    </main>
  );
}
