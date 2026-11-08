import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { openDashboard } from './lib/navigation';
vi.mock('./lib/navigation', () => ({ openDashboard: vi.fn() }));

describe('website navigation', () => {
  it('opens the teammate workspace and returns home without homepage API requests', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole('link', { name: 'Open dashboard' })[0]);
    expect(openDashboard).toHaveBeenLastCalledWith('/dashboard-app/index.html');
    fireEvent.click(screen.getByRole('link', { name: 'Back to website' }));
    expect(screen.getByRole('heading', { name: 'How well does AI understand accented English?' })).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('supports a direct community visit with a configured backend', () => {
    render(<MemoryRouter initialEntries={['/dashboard?tab=community&backend=https%3A%2F%2Fapi.example.com']}><App /></MemoryRouter>);
    expect(openDashboard).toHaveBeenLastCalledWith('/dashboard-app/index.html?backend=https%3A%2F%2Fapi.example.com#where');
  });

  it('does not forward unsafe backend protocols to the workspace', () => {
    render(<MemoryRouter initialEntries={['/dashboard?backend=javascript%3Aalert(1)']}><App /></MemoryRouter>);
    expect(openDashboard).toHaveBeenLastCalledWith('/dashboard-app/index.html');
  });

  it.each(['overview', 'clips', 'review', 'settings', 'languages', 'callcheck'])('opens the %s section from a direct guide link', (tab) => {
    render(<MemoryRouter initialEntries={[`/dashboard?tab=${tab}`]}><App /></MemoryRouter>);
    expect(openDashboard).toHaveBeenLastCalledWith(`/dashboard-app/index.html#${tab}`);
  });

  it('explains dashboard tasks and links Call Check to its implementation without requesting a check', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'What is the dashboard for?' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Clip explorer' })).toHaveAttribute('href', '/dashboard?tab=clips');
    expect(screen.getByRole('link', { name: 'Open Call Check' })).toHaveAttribute('href', '/dashboard?tab=callcheck');
    fireEvent.click(screen.getByText('View Call Check source code'));
    expect(screen.getByRole('link', { name: /Keyword rules, weights and verdict thresholds/ })).toHaveAttribute('href', 'https://github.com/MurtLK/lapeace/blob/main/backend/src/scamrules.js');
    expect(screen.getByText('No red flags does not mean a caller is legitimate.')).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns from the dashboard to the homepage guide', () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard guide' }));
    expect(screen.getByRole('heading', { name: 'What is the dashboard for?' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Opening the dashboard...' })).not.toBeInTheDocument();
  });

  it('provides a useful return destination for unknown routes', () => {
    render(<MemoryRouter initialEntries={['/missing']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'This page isn’t here.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to website' })).toHaveAttribute('href', '/');
  });

  it('closes mobile navigation on Escape and restores focus to its trigger', async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    const menu = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();
  });

  it('updates the reference inspector without requesting audio or model output', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter><App /></MemoryRouter>);
    const lastSentence = screen.getByRole('button', { name: /She can scoop these things/ });
    fireEvent.click(lastSentence);
    expect(lastSentence).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('She can scoop these things into three red bags, and we will go meet her Wednesday at the train station.')).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
});
