# Dataset setup required

The website source is included. The transcript CSVs are pending approval and are not included in this commit. Place cleaned.csv and original.csv in dist/ before running the app.

# Mississauga, Unheard

An interactive research workspace for reviewing accented-English AI transcripts from the Speech Accent Archive.

Live app: https://mississauga-unheard-lab.cheekybowl25.chatgpt.site

## Run locally

No build step or package installation is required. With Python 3 installed, run:

```bash
python -m http.server 8000 --directory dist
```

Open http://localhost:8000. Serve the files over HTTP because the app fetches its CSV datasets.

## Features

- Search recordings, accent groups, transcript text and saved review notes.
- Filter by accent group, flags or empty transcripts.
- Rank groups by mean WER or SER, with sample sizes and individual recording variation.
- Compare each transcript against one shared reference with highlighted word edits and four fixed reference sections.
- Attach local audio files by matching filenames and play them in the clip dialog.
- Save review flags, notes, analysis settings and cached results in browser storage.
- Export filtered clip tables, group summaries and workspace backups.
- Restore review state from a workspace backup.

## Files

| File | Purpose |
| --- | --- |
| `dist/index.html` | App structure and controls |
| `dist/style.css` | Responsive visual design |
| `dist/app.js` | Filtering, alignment, scoring, review state and exports |
| `dist/cleaned.csv` | 468 cleaned transcripts across 15 accent groups |
| `dist/original.csv` | Earlier supplied WER/SER values matched by filename |

## Scoring

All recordings use the same English reference paragraph, beginning “Please call Stella” and ending “at the train station.”

WER is `(substitutions + deletions + insertions) / reference words * 100`. The app ignores case and punctuation and normalizes digits 3, 5 and 6 to words. Optional settings ignore `um`/`uh` or exclude `Stella`/`Stila` from both texts.

SER is the percentage of four fixed reference sections containing any aligned word error. These sections are a reproducible convention because transcript punctuation is mostly missing. They do not recover the speaker's actual sentence boundaries.

The default uses recalculated scores from the cleaned transcripts. The alternative score source displays the earlier supplied scores. Highlights always use the current cleaned alignment settings.

## Persistence and limitations

Review state is local to the current browser. There is no server database or live team synchronization. Audio files remain in the current session and must be reattached after reopening. Backups transfer notes, flags and settings, but do not embed audio or replace the bundled datasets.

One recording acts as a speaker proxy. Group comparisons describe this sample and do not establish causal accent effects or population-wide failure rates. The app does not automatically detect silence, transcribe new recordings or include FLEURS, census maps or a multilingual 311 agent.

## Dataset provenance

The dataset files are the project team's supplied AI transcript analysis of Speech Accent Archive recordings. Audio recordings are not bundled. No license for the source recordings or supplied datasets is asserted by this repository.

## Hosting

The app is static. Any web host can serve the contents of `dist/`. This GitHub copy excludes Sites-specific project configuration and deployment credentials.
