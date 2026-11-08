"""Create complete web previews from the event's Speech Accent Archive MP3s.
Original audio stays unchanged. Analysis/transcription results are never recomputed here.
"""
import argparse, concurrent.futures, hashlib, json, subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
out = root / 'web/public/dashboard-app/audio'
out.mkdir(parents=True, exist_ok=True)
samples = json.loads((root / 'backend/data/samples.saa.json').read_text())['samples']
names = sorted({s['audio_file'] for s in samples})
missing = [n for n in names if not (args.source / n).is_file()]
if missing:
    raise SystemExit(f'{len(missing)} required source clips are missing.')
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def convert(name):
    source, target = args.source / name, out / name
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-map', '0:a:0',
                    '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '48k',
                    '-threads', '1', str(target)], check=True, capture_output=True)
    return {'file': name, 'source_sha256': sha(source), 'preview_sha256': sha(target),
            'preview_bytes': target.stat().st_size}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    records = list(pool.map(convert, names))
manifest = {
 'source': 'Speech Accent Archive, supplied Sheridan Datathon 2026 dataset',
 'attribution': 'Weinberger, S. (2015). Speech Accent Archive. George Mason University.',
 'source_url': 'https://accent.gmu.edu', 'license': 'CC BY-NC-SA 4.0',
 'license_url': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
 'preview_format': 'Complete recording, re-encoded as mono 22.05 kHz 48 kbps MP3 for browser playback.',
 'analysis_note': 'Preview compression does not change the stored transcripts or benchmark scores. Original recordings remain the evaluation source.',
 'clips': records,
}
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'imported_clips': len(records), 'preview_MB': round(sum(r['preview_bytes'] for r in records)/1e6, 1)}))
