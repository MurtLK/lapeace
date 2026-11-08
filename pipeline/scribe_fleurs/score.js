// Score cached FLEURS Scribe transcripts: CER (primary) and WER (where whitespace tokenization fits).
//   node score.js --dataset <02_speech_home_languages_FLEURS> --selection pilot|all [--tag pilot]
// Normalization (both reference and hypothesis): Unicode NFC; lowercase; Unicode punctuation (\p{P})
// and symbols (\p{S}) -> space; whitespace collapsed. Accents, diacritics, combining marks (\p{M}, e.g.
// Indic vowel signs) and script are preserved; no transliteration or script conversion.
// Reference = raw_transcription (as written), normalized the same way as the output.
// CER = character edit distance / reference characters, with whitespace removed (so spaced Chinese
// references compare fairly). WER = whitespace-token edit distance; not reported for Mandarin/Cantonese.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, LANG_CODES } from './lib.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({ options: { dataset: { type: 'string' }, selection: { type: 'string', default: 'pilot' },
  out: { type: 'string', default: path.join(here, '..', '..', 'results', 'scribe_fleurs') }, tag: { type: 'string' } } });
const out = path.resolve(args.out), dataset = path.resolve(args.dataset);
const tag = args.tag ?? args.selection;

export const normalize = (s) => s.normalize('NFC').toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
function edit(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const chars = (s) => [...s.replace(/\s/g, '')];
const NO_WER = new Set(['cmn_hans_cn', 'yue_hant_hk']);
// Expected script of letters per language (for the script check).
const SCRIPT = { ur_pk: 'Arabic', ar_eg: 'Arabic', cmn_hans_cn: 'Han', yue_hant_hk: 'Han', pa_in: 'Gurmukhi', ta_in: 'Tamil',
  hi_in: 'Devanagari', gu_in: 'Gujarati' };
function scriptShare(text, lang) {
  const s = SCRIPT[lang] ?? 'Latin';
  const letters = [...text].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return null;
  return letters.filter((c) => new RegExp(`\\p{Script=${s}}`, 'u').test(c)).length / letters.length;
}

const meta = parseCsv(await readFile(path.join(dataset, 'metadata.csv'), 'utf8')).map((m) => ({ ...m, clip_id: path.basename(m.file, path.extname(m.file)) }));
let clips = meta;
if (args.selection !== 'all') { const s = JSON.parse(await readFile(path.join(out, `selection_${args.selection}.json`), 'utf8')); clips = meta.filter((m) => s.clips.includes(m.clip_id)); }
const cacheFiles = await readdir(path.join(out, 'cache'));
const failures = (await readFile(path.join(out, 'failures.jsonl'), 'utf8').catch(() => '')).split('\n').filter(Boolean).map((l) => JSON.parse(l));

const rows = [];
for (const m of clips) {
  const settings = { model_id: 'scribe_v2', language_code: LANG_CODES[m.lang_config], tag_audio_events: false, keyterms: [] };
  const h = createHash('sha256').update(JSON.stringify(settings)).digest('hex').slice(0, 10);
  const f = cacheFiles.find((x) => x === `${m.clip_id}.${h}.json`);
  const base = { clip_id: m.clip_id, sentence_id: m.fleurs_id, language: m.language, lang_config: m.lang_config, variety_note: m.variety_note,
    gender: m.gender, duration_sec: m.duration_sec, scribe_language_code_sent: settings.language_code, reference_raw: m.raw_transcription };
  if (!f) { const fl = failures.findLast((x) => x.clip_id === m.clip_id); rows.push({ ...base, status: fl ? `failed_http_${fl.http ?? 'error'}` : 'not_run' }); continue; }
  const r = JSON.parse(await readFile(path.join(out, 'cache', f), 'utf8')).response;
  const ref = normalize(m.raw_transcription), hyp = normalize(r.text ?? '');
  const rc = chars(ref), hc = chars(hyp);
  const ce = edit(rc, hc);
  const rw = ref.split(' ').filter(Boolean), hw = hyp.split(' ').filter(Boolean);
  const we = NO_WER.has(m.lang_config) ? null : edit(rw, hw);
  const share = scriptShare(r.text ?? '', m.lang_config);
  const flags = [];
  if (r.language_code && r.language_code !== settings.language_code) flags.push(`returned_language_${r.language_code}`);
  if (share !== null && share < 0.9) flags.push(`script_mismatch_${(share * 100).toFixed(0)}pct_expected_script`);
  if (!hyp) flags.push('empty_output');
  rows.push({ ...base, scribe_raw: r.text ?? '', scribe_language_code_returned: r.language_code, scribe_language_probability: r.language_probability,
    reference_norm: ref, scribe_norm: hyp, ref_chars: rc.length, char_errors: ce, cer: +(ce / rc.length).toFixed(4),
    ref_words: NO_WER.has(m.lang_config) ? '' : rw.length, word_errors: we ?? '', wer: we === null ? '' : +(we / rw.length).toFixed(4),
    expected_script_share: share === null ? '' : +share.toFixed(3), status: flags.length ? 'scored_flagged' : 'scored', flags: flags.join(';') });
}

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (x) => (x * 100).toFixed(1);
const summary = [];
for (const lang of [...new Set(rows.map((r) => r.lang_config))]) {
  const all = rows.filter((r) => r.lang_config === lang), sc = all.filter((r) => r.cer !== undefined);
  const cer = sc.map((r) => r.cer), wer = sc.filter((r) => r.wer !== '').map((r) => r.wer);
  const g = {}; for (const r of all) g[r.gender] = (g[r.gender] ?? 0) + 1;
  const notes = ['No speaker IDs in metadata: unique speakers unknown (dataset notes few speakers per language)'];
  if (Object.keys(g).length === 1) notes.push(`all clips recorded ${Object.keys(g)[0]}`);
  if (NO_WER.has(lang)) notes.push('CER only: no documented word segmentation');
  if (lang === 'vi_vn') notes.push('WER counts syllables (Vietnamese spaces separate syllables)');
  if (['ta_in'].includes(lang)) notes.push('WER inflated by long agglutinative words; prefer CER');
  const fl = sc.filter((r) => r.flags).length; if (fl) notes.push(`${fl} clip(s) flagged (language/script)`);
  summary.push({ language: all[0].language, lang_config: lang, scribe_code: all[0].scribe_language_code_sent, attempted: all.length, scored: sc.length,
    unique_speakers: 'unknown', gender_counts: Object.entries(g).map(([k, v]) => `${k} ${v}`).join('; '),
    mean_cer_pct: sc.length ? pct(mean(cer)) : '', median_cer_pct: sc.length ? pct(q(cer, 0.5)) : '',
    min_cer_pct: sc.length ? pct(Math.min(...cer)) : '', p75_cer_pct: sc.length ? pct(q(cer, 0.75)) : '', max_cer_pct: sc.length ? pct(Math.max(...cer)) : '',
    mean_wer_pct: wer.length ? pct(mean(wer)) : '', median_wer_pct: wer.length ? pct(q(wer, 0.5)) : '', notes: notes.join('; ') });
}
summary.sort((a, b) => b.median_cer_pct - a.median_cer_pct || b.mean_cer_pct - a.mean_cer_pct);
const cell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rs, cols) => [cols.join(','), ...rs.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
const TC = ['clip_id', 'sentence_id', 'language', 'lang_config', 'variety_note', 'gender', 'duration_sec', 'scribe_language_code_sent', 'scribe_language_code_returned', 'scribe_language_probability', 'reference_raw', 'scribe_raw', 'reference_norm', 'scribe_norm', 'ref_chars', 'char_errors', 'cer', 'ref_words', 'word_errors', 'wer', 'expected_script_share', 'status', 'flags'];
const sfx = tag === 'all' ? '' : `_${tag}`;
await writeFile(path.join(out, `fleurs_transcripts${sfx}.csv`), '﻿' + csv(rows, TC));
await writeFile(path.join(out, `fleurs_summary_by_language${sfx}.csv`), '﻿' + csv(summary, Object.keys(summary[0])));
console.table(summary.map(({ language, attempted, scored, gender_counts, mean_cer_pct, median_cer_pct, min_cer_pct, max_cer_pct, mean_wer_pct, median_wer_pct }) => ({ language, attempted, scored, gender_counts, mean_cer_pct, median_cer_pct, min_cer_pct, max_cer_pct, mean_wer_pct, median_wer_pct })));
const flagged = rows.filter((r) => r.flags); if (flagged.length) console.log('FLAGGED', flagged.map((r) => `${r.clip_id}: ${r.flags}`));
console.log('not scored', rows.filter((r) => r.cer === undefined).map((r) => `${r.clip_id}:${r.status}`));
