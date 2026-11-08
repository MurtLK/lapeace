import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
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
  if (tab === 'languages' || tab === 'callcheck') url.hash = tab;
  const src = `${url.pathname}${url.search}${url.hash}`;

  return (
    <main className="research-dashboard">
      <nav className="research-dashboard__nav" aria-label="Dashboard navigation">
        <Link to="/"><ArrowLeft aria-hidden="true" size={18} />Back to website</Link>
        <a href={src} target="_blank" rel="noopener noreferrer">Open workspace in a new tab<ExternalLink aria-hidden="true" size={16} /></a>
      </nav>
      <iframe className="research-dashboard__frame" src={src} title="LAPEACE research dashboard" allow="microphone" />
    </main>
  );
}
