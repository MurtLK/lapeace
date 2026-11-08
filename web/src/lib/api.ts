const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nullableNumber = (v: unknown): v is number | null => v === null || number(v);

export interface Sample { clip_id: string; speaker_group: string; duration_sec: number; reference_transcript: string; scribe_transcript: string; scribe_transcript_is_simulated: boolean; wer: number | null; audio_url: string }
export interface SamplesResponse { source: string; notice: string; featured_clip_id?: string | null; samples: Sample[] }
export interface Ward { geo: string | number; residents: number; pct_of_geo: number; share_of_city_speakers: number }
export interface CensusLanguage { language: string; city_total: number; wards: Ward[] }
export interface CensusResponse { source: string; measure: string; notes: string[]; languages: CensusLanguage[]; problems: unknown[] }
export interface ClarificationCase { case_id: string; intended_label: string; request_script: string; scribe_heard: string; first_interpretation_label: string; first_correct: boolean; correction_script: string | null; correction_heard: string | null; final_confirmed_label: string; final_correct: boolean }
export interface ClarificationResponse { description: string; limits: string[]; cases: ClarificationCase[] }

export const isSamples = (v: unknown): v is SamplesResponse => record(v) && text(v.source) && text(v.notice) && Array.isArray(v.samples) && v.samples.every((s: unknown) => record(s) && ['clip_id', 'speaker_group', 'reference_transcript', 'scribe_transcript', 'audio_url'].every((key) => text(s[key])) && number(s.duration_sec) && typeof s.scribe_transcript_is_simulated === 'boolean' && nullableNumber(s.wer));
export const isCensus = (v: unknown): v is CensusResponse => record(v) && text(v.source) && text(v.measure) && Array.isArray(v.notes) && v.notes.every(text) && Array.isArray(v.problems) && Array.isArray(v.languages) && v.languages.every((l: unknown) => record(l) && text(l.language) && number(l.city_total) && Array.isArray(l.wards) && l.wards.every((w: unknown) => record(w) && (text(w.geo) || number(w.geo)) && number(w.residents) && number(w.pct_of_geo) && number(w.share_of_city_speakers)));
export const isClarification = (v: unknown): v is ClarificationResponse => record(v) && text(v.description) && Array.isArray(v.limits) && v.limits.every(text) && Array.isArray(v.cases) && v.cases.every((c: unknown) => record(c) && ['case_id', 'intended_label', 'request_script', 'scribe_heard', 'first_interpretation_label', 'final_confirmed_label'].every((key) => text(c[key])) && typeof c.first_correct === 'boolean' && typeof c.final_correct === 'boolean' && (c.correction_script === null || text(c.correction_script)) && (c.correction_heard === null || text(c.correction_heard)));

export class ApiError extends Error {
  constructor(message: string, public readonly unavailable = false) { super(message); this.name = 'ApiError'; }
}

export async function getApi<T>(path: string, validate: (value: unknown) => value is T, signal: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(`${API_BASE}${path}`, { signal, headers: { Accept: 'application/json' } }); }
  catch (error) { if (signal.aborted) throw error; throw new ApiError('The evidence service could not be reached. Check the connection and try again.', true); }
  if (!response.ok) throw new ApiError(response.status === 404 ? 'This dataset is not available from the connected evidence service yet.' : 'The evidence service could not complete this request. Please try again.', response.status === 404);
  let value: unknown;
  try { value = await response.json(); } catch { throw new ApiError('The evidence service returned an unreadable response. Please try again.'); }
  if (!validate(value)) throw new ApiError('The evidence response did not match its expected format. Please try again.');
  return value;
}

export function resolveAudio(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    const backend = API_BASE ? new URL(API_BASE, window.location.origin).origin : 'http://localhost:8787';
    if (!['http:', 'https:'].includes(parsed.protocol) || !['/audio/', '/audio311/'].some((prefix) => parsed.pathname.startsWith(prefix))) return null;
    if (![window.location.origin, backend, 'http://127.0.0.1:8787'].includes(parsed.origin)) return null;
    return API_BASE ? parsed.href : `${parsed.pathname}${parsed.search}`;
  } catch { return null; }
}

export const formatWer = (value: number | null): string => value === null || !Number.isFinite(value) ? 'Unavailable' : `${(value * 100).toFixed(1)}%`;
