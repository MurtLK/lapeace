import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('website navigation', () => {
  it('keeps every project link on the homepage without requesting dashboard data', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'How well does AI understand accented English?' })).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Explore the project' })[0]).toHaveAttribute('href', '#how-it-works');
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toContain('/dashboard');
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not expose the removed dashboard on a direct visit', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter initialEntries={['/dashboard?tab=evidence']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'This page isn’t here.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to website' })).toHaveAttribute('href', '/');
    expect(fetch).not.toHaveBeenCalled();
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
