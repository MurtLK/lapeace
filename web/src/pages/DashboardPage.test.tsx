import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

const fixture = {
  source: 'fixture', notice: 'Synthetic test fixture, not benchmark evidence.', featured_clip_id: 'test1',
  samples: [{ clip_id: 'test1', speaker_group: 'English', duration_sec: 1, reference_transcript: 'Synthetic reference text.', scribe_transcript: 'Synthetic returned text.', scribe_transcript_is_simulated: true, wer: 0, audio_url: 'http://localhost:8787/audio/test1.mp3' }],
};
const response = (data: unknown) => ({ ok: true, status: 200, json: async () => data });

describe('dashboard evidence states', () => {
  it('preserves unavailable state with an explicit retry', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Offline')).mockResolvedValue(response(fixture));
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Evidence is unavailable.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Synthetic reference text.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('labels fixtures and refuses to report their score as measured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(fixture)));
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText('Fixture — simulated transcript')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
  });

  it('selects community via the URL and never creates a live session', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ source: 'Synthetic census test', measure: 'Home language', notes: [], languages: [], problems: [] }));
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter initialEntries={['/dashboard?tab=community']}><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText('The connected service has not supplied census language groups.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Community' })).toHaveAttribute('aria-current', 'page');
    expect(fetch).toHaveBeenCalledWith('/api/census', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(fetch.mock.calls.every(([url]) => !String(url).includes('agent'))).toBe(true);
  });

  it('aborts an old request when switching views', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      signals.push(options.signal as AbortSignal);
      return new Promise(() => undefined);
    }));
    render(<MemoryRouter initialEntries={['/dashboard']}><DashboardPage /></MemoryRouter>);
    await waitFor(() => expect(signals).toHaveLength(1));
    fireEvent.click(screen.getByRole('link', { name: 'Community' }));
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it('keeps empty sample arrays distinct from a failed request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ source: 'fixture', notice: 'Synthetic test', samples: [] })));
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText('The connected service has not supplied any recordings.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
