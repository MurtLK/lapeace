import { describe, expect, it, vi } from 'vitest';
import { formatWer, getApi, isSamples, resolveAudio } from './api';

describe('source-backed display contracts', () => {
  it('distinguishes missing scores from zero and preserves insertion-heavy WER', () => {
    expect(formatWer(null)).toBe('Unavailable');
    expect(formatWer(0)).toBe('0.0%');
    expect(formatWer(0.087)).toBe('8.7%');
    expect(formatWer(1.25)).toBe('125.0%');
  });

  it('rejects malformed API samples rather than asserting an unchecked type', () => {
    expect(isSamples({ source: 'fixture', notice: 'Synthetic test', samples: [{ clip_id: 'a' }] })).toBe(false);
    expect(isSamples({ source: 'fixture', notice: 'Synthetic test', samples: [] })).toBe(true);
  });

  it('rejects arbitrary remote media and preserves known audio query strings', () => {
    expect(resolveAudio('https://unrelated.example/audio/a.mp3')).toBeNull();
    expect(resolveAudio('javascript:alert(1)')).toBeNull();
    expect(resolveAudio('http://localhost:8787/audio/urdu1.mp3?version=1')).toBe('/audio/urdu1.mp3?version=1');
  });

  it('turns a missing dataset into an explicit unavailable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(getApi('/api/samples', isSamples, new AbortController().signal)).rejects.toMatchObject({ unavailable: true });
  });
});
