"""Audit of the 468-clip Scribe v2 accented-English benchmark -> data/audit.json (+ CSV).

Run with:  /usr/local/bin/python3 -I scripts/build_audit.py --samples data/samples.saa.json \
             --transcripts <scribe transcripts.csv> --audio-dir <SAA audio> --wav-cache <tmp dir> \
             [--out data/audit.json] [--csv <clip_audit.csv>]

Does not change the benchmark. Adds, per clip: audio measurements (decoded with macOS afconvert to
16 kHz mono) and transcript-based signals, then an automatic *candidate* category for human listening:
  - possible_recording_problem : speech-to-noise proxy < 20 dB (about the worst 5%) or noise floor > -35 dBFS
  - likely_script_departure    : >= 4 inserted words AND (an immediate repeat, stutter fragments, or >= 2 fillers)
  - likely_transcription_error : WER > 0 with mostly substituted/missed words and neither flag above
These are heuristics to prioritise listening, not verified labels.
"""
import argparse, csv, json, os, re, subprocess, wave, statistics as st
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--samples', required=True)
ap.add_argument('--transcripts', required=True)
ap.add_argument('--audio-dir', required=True)
ap.add_argument('--wav-cache', required=True)
ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'data', 'audit.json'))
ap.add_argument('--csv')
a = ap.parse_args()

samples = {s['clip_id']: s for s in json.load(open(a.samples))['samples']}
counts = {r['clip_id']: r for r in csv.DictReader(open(a.transcripts))}
os.makedirs(a.wav_cache, exist_ok=True)

def audio_metrics(clip_id, audio_file):
    w = os.path.join(a.wav_cache, clip_id + '.wav')
    if not os.path.exists(w):
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', os.path.join(a.audio_dir, audio_file), w], check=True)
    with wave.open(w) as h:
        x = np.frombuffer(h.readframes(h.getnframes()), dtype='<i2').astype(np.float32) / 32768.0
        sr = h.getframerate()
    frame = int(0.05 * sr); n = len(x) // frame
    db = 20 * np.log10(np.sqrt((x[:n * frame].reshape(n, frame) ** 2).mean(1)) + 1e-9)
    p10, p95 = float(np.percentile(db, 10)), float(np.percentile(db, 95))
    return dict(rms_dbfs=round(float(20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9)), 1),
                clipped_pct=round(float((np.abs(x) >= 0.999).mean() * 100), 3),
                noise_floor_dbfs=round(p10, 1), snr_proxy_db=round(p95 - p10, 1))

FILLERS = {'uh', 'um', 'uhm', 'umm', 'er', 'erm', 'ah', 'hmm', 'mm', 'mhm', 'eh'}
def transcript_signals(text):
    toks = re.findall(r"[a-z']+(?:-[a-z']*)*-?", text.lower())
    words = [t.strip('-') for t in toks]
    fillers = sum(w in FILLERS for w in words)
    fragments = sum('-' in t for t in toks)
    content = [w for w in words if w and w not in FILLERS]
    repeat = any(content[i] == content[i + 1] for i in range(len(content) - 1)) or \
        any(content[i:i + 2] == content[i + 2:i + 4] for i in range(len(content) - 3))
    return dict(fillers=fillers, stutter_fragments=fragments, immediate_repeat=repeat)

clips = []
for cid, s in samples.items():
    c = counts[cid]
    m = audio_metrics(cid, s['audio_file'])
    t = transcript_signals(s['scribe_transcript'])
    S, D, I = int(c['substitutions']), int(c['deletions']), int(c['insertions'])
    rec = m['snr_proxy_db'] < 20 or m['noise_floor_dbfs'] > -35
    dep = I >= 4 and (t['immediate_repeat'] or t['stutter_fragments'] > 0 or t['fillers'] >= 2)
    cat = 'no_errors' if s['wer'] == 0 else 'possible_recording_problem' if rec else 'likely_script_departure' if dep else 'likely_transcription_error'
    clips.append(dict(clip_id=cid, speaker_group=s['speaker_group'], gender=s['speaker']['gender'], wer=s['wer'],
                      substitutions=S, deletions=D, insertions=I, **m, **t, candidate_category=cat,
                      recording_flag=rec, departure_flag=dep))

def stats(ws):
    return dict(n=len(ws), median_wer=round(st.median(ws), 4), mean_wer=round(st.mean(ws), 4)) if ws else dict(n=0)

groups = sorted({c['speaker_group'] for c in clips})
table = []
for g in groups:
    rows = [c for c in clips if c['speaker_group'] == g]
    f = [c['wer'] for c in rows if c['gender'] == 'female']; m_ = [c['wer'] for c in rows if c['gender'] == 'male']
    minority = min(len(f), len(m_))
    table.append(dict(speaker_group=g, all=stats([c['wer'] for c in rows]), female=stats(f), male=stats(m_),
                      median_snr_proxy_db=round(st.median(c['snr_proxy_db'] for c in rows), 1),
                      small_sample=len(rows) < 20, gender_unbalanced=minority < 0.3 * len(rows),
                      gender_split_unreliable=minority < 5))
table.sort(key=lambda r: -r['all']['median_wer'])

# Does recording quality track WER? Spearman rank correlation (no scipy).
def spearman(x, y):
    rx, ry = np.argsort(np.argsort(x)), np.argsort(np.argsort(y))
    return float(np.corrcoef(rx, ry)[0, 1])
snr_rho = round(spearman([c['snr_proxy_db'] for c in clips], [c['wer'] for c in clips]), 3)
non_en = [c for c in clips if c['speaker_group'] != 'English']
snr_rho_non_en = round(spearman([c['snr_proxy_db'] for c in non_en], [c['wer'] for c in non_en]), 3)

# Listening list: 8 highest-WER clips (any group) + 4 zero-WER non-English clips (spread across groups).
by_wer = sorted(clips, key=lambda c: (-c['wer'], c['clip_id']))
high = by_wer[:8]
low, seen = [], set()
for c in sorted(non_en, key=lambda c: (c['wer'], -c['snr_proxy_db'], c['clip_id'])):
    if c['wer'] == 0 and c['speaker_group'] not in seen and c['speaker_group'] in ('Mandarin Chinese', 'Punjabi', 'Arabic', 'Vietnamese', 'Urdu', 'Cantonese'):
        low.append(c); seen.add(c['speaker_group'])
    if len(low) == 4: break
keep = ['clip_id', 'speaker_group', 'gender', 'wer', 'substitutions', 'deletions', 'insertions', 'fillers',
        'stutter_fragments', 'immediate_repeat', 'snr_proxy_db', 'noise_floor_dbfs', 'candidate_category']
cats = {k: sum(c['candidate_category'] == k for c in clips) for k in ['no_errors', 'likely_transcription_error', 'likely_script_departure', 'possible_recording_problem']}

out = dict(
    source='Speech Accent Archive x ElevenLabs Scribe v2 benchmark (468 clips), unchanged',
    wer_unit='fraction (0.05 = 5%)',
    microphone_metadata='Not available: metadata.csv has no microphone, device or recording-location field. Audio quality was measured from the files instead.',
    audio_measures=dict(
        clipping=f"{sum(c['clipped_pct'] > 0.01 for c in clips)} of {len(clips)} clips have any clipping (samples at full scale > 0.01%)",
        snr_proxy='speech level (95th percentile of 50 ms frame loudness) minus noise floor (10th percentile), in dB; higher = cleaner',
        snr_proxy_range_db=[min(c['snr_proxy_db'] for c in clips), round(st.median(c['snr_proxy_db'] for c in clips), 1), max(c['snr_proxy_db'] for c in clips)],
        spearman_snr_vs_wer_all=snr_rho, spearman_snr_vs_wer_non_english=snr_rho_non_en),
    category_rules=dict(
        possible_recording_problem='speech-to-noise proxy < 20 dB or noise floor > -35 dBFS',
        likely_script_departure='>= 4 inserted words and (an immediate repeat, stutter fragments, or >= 2 fillers) in the Scribe transcript',
        likely_transcription_error='WER > 0 and neither flag above',
        note='Automatic heuristics to prioritise human listening; not verified labels.'),
    category_counts=cats,
    by_group_and_gender=table,
    listening_review=dict(high_wer=[{k: c[k] for k in keep} for c in high], low_wer=[{k: c[k] for k in keep} for c in low],
                          possible_recording_problem=[{k: c[k] for k in keep} for c in sorted(clips, key=lambda c: c['snr_proxy_db']) if c['recording_flag']]),
)
json.dump(out, open(a.out, 'w'), indent=2)
if a.csv:
    with open(a.csv, 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=list(clips[0])); w.writeheader(); w.writerows(sorted(clips, key=lambda c: c['clip_id']))
print(json.dumps({k: out[k] for k in ['audio_measures', 'category_counts']}, indent=1))
for r in table: print(f"{r['speaker_group']:17} n={r['all']['n']:>2} med {r['all']['median_wer']*100:4.1f}%  F n={r['female']['n']:>2} med {r['female'].get('median_wer',0)*100:4.1f}%  M n={r['male']['n']:>2} med {r['male'].get('median_wer',0)*100:4.1f}%  snr {r['median_snr_proxy_db']}  {'SMALL ' if r['small_sample'] else ''}{'UNBALANCED' if r['gender_unbalanced'] else ''}")
for k in ['possible_recording_problem']:
    print(k); [print('  ', c['clip_id'], c['speaker_group'], c['gender'], c['wer'], f"S{c['substitutions']} D{c['deletions']} I{c['insertions']} fill{c['fillers']} frag{c['stutter_fragments']} rep{c['immediate_repeat']} snr{c['snr_proxy_db']}", c['candidate_category']) for c in out['listening_review'][k]]
