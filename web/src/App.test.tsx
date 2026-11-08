import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('website navigation', () => {
  it('opens the teammate workspace and returns home without homepage API requests', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole('link', { name: 'Open dashboard' })[0]);
    expect(screen.getByTitle('LAPEACE research dashboard')).toHaveAttribute('src', '/dashboard-app/index.html');
    fireEvent.click(screen.getByRole('link', { name: 'Back to website' }));
    expect(screen.getByRole('heading', { name: 'How well does AI understand accented English?' })).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('supports a direct community visit with a configured backend', () => {
    render(<MemoryRouter initialEntries={['/dashboard?tab=community&backend=https%3A%2F%2Fapi.example.com']}><App /></MemoryRouter>);
    expect(screen.getByTitle('LAPEACE research dashboard')).toHaveAttribute('src', '/dashboard-app/index.html?backend=https%3A%2F%2Fapi.example.com#where');
  });

  it('does not forward unsafe backend protocols to the workspace', () => {
    render(<MemoryRouter initialEntries={['/dashboard?backend=javascript%3Aalert(1)']}><App /></MemoryRouter>);
    expect(screen.getByTitle('LAPEACE research dashboard')).toHaveAttribute('src', '/dashboard-app/index.html');
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
