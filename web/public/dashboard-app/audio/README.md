# Imported Speech Accent Archive audio previews

Source: Weinberger, S. (2015). Speech Accent Archive. George Mason University. https://accent.gmu.edu and https://osf.io/yh23d

The Sheridan Datathon 2026 ElevenLabs dataset pack identifies these source recordings as CC BY-NC-SA 4.0. These compressed previews are distributed under the same license: https://creativecommons.org/licenses/by-nc-sa/4.0/.

Changes: complete recordings re-encoded as 48 kbps, mono, 22.05 kHz MP3s for web delivery. No recording was trimmed. Original recordings remain unchanged locally; existing transcripts and benchmark scores were not recomputed on the compressed previews.

`manifest.json` lists all 468 filenames, source hashes, preview hashes and sizes. Recreate the previews with `python3 scripts/import-audio.py --source <extracted-archive-audio-folder>` from the repository root. FFmpeg is required for this one-time import, not for normal builds or playback.
