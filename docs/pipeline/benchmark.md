# Reviewed transcription and scoring

The current evaluation uses the original 40 Buzz outputs and the friend's corrected references, as requested by Murtada. Use [the offline Buzz import guide](buzz.md); another ElevenLabs batch is not required. The optional live workflow below documents the existing adapter and budget gates. Its two-clip smoke is separate evidence and must not be pooled with the Buzz run.

This is Murtada's benchmark pipeline. Hisham's app/service adapter is separate. Every command defaults to offline behavior. The provider transport follows the [official Scribe endpoint](https://elevenlabs.io/docs/api-reference/speech-to-text/convert), checked November 8, 2026. It submits the original MP3 with the model/settings frozen in the manifest: `scribe_v2`, `language_code=en`, `diarize=false`, `tag_audio_events=false`, `no_verbatim=false`. Reference text, keyterms, translation, and transcript cleanup are never sent.

## 1. Import listening approval

Use the existing `review_queue.csv` headers. Every one of the 40 rows must be `accepted`, `meaning_review=verified`, have a reviewer, and have a timestamp with timezone. Corrections require `reference_override` plus `override_reason`. Exclusions/replacements require a separately frozen selection and are refused here.

```sh
uv run --offline python -m lapeace_data review-import \
  --manifest /absolute/path/to/original/manifest.json \
  --dataset-root /absolute/path/to/extracted/dataset \
  --review-csv /absolute/path/to/completed/review_queue.csv
```

If the coordinator explicitly confirms that a friend reviewed all clips and no corrections were supplied, an attestation can instead record that confirmation:

```sh
uv run --offline python -m lapeace_data review-import \
  --manifest /absolute/path/to/original/manifest.json \
  --dataset-root /absolute/path/to/extracted/dataset \
  --reviewer 'Friend (name not provided)' \
  --attested-by Murtada \
  --note 'All 40 clips and existing references were reviewed and accepted; no corrections supplied.'
```

The timestamp on an attestation records receipt of the confirmation; it is not a claim about when the friend listened. Buzz exports are not imported as ground truth. If your friend corrected those exports, import the actual listening-confirmed corrections through the CSV override fields before scoring.

`data/derived/reviewed-pilot.json` points to the new manifest and receipt. The original manifest and pending bundle remain unchanged. The new receipt preserves original references, parent hash, reviewer records, and the attestation or CSV hash. Repeating an attestation records a new receipt; use the saved pointer instead of re-importing on each run.

## 2. Plan the two-clip smoke test

Set `LAPEACE_REVIEWED_MANIFEST` to `manifest_path` from the reviewed pointer. This variable contains a path, not a secret.

```sh
uv run --offline python -m lapeace_data transcribe \
  --manifest "$LAPEACE_REVIEWED_MANIFEST" --phase smoke --dry-run
```

The first baseline clip and first Urdu-cohort clip in the frozen order are chosen before seeing results. For the current pilot: `saa:english247` and `saa:urdu7`, total 47.866508 audio seconds. The plan prints selected IDs, cached/blocked/new submissions, counters, caps, run directory, and `plan_sha256`. It makes no requests and writes no artifacts. The original unreviewed manifest retains its legacy 40-clip estimate behavior.

## 3. Configure credentials and authorize smoke separately

The operator must securely set `ELEVENLABS_API_KEY` in the process environment. The CLI does not load `.env`. Use the environment's private secret entry mechanism; never put the key in chat, command arguments, manifests, or Git. Default tests do not read an API key. Account/model availability remains unverified until the authorized smoke request is accepted.

Only after operator approval of the exact printed plan:

```sh
uv run --offline python -m lapeace_data transcribe \
  --manifest "$LAPEACE_REVIEWED_MANIFEST" --phase smoke \
  --live --approve-plan '<plan_sha256 from the current dry run>'
```

`uv --offline` prevents package downloads; the explicit `--live` application flag permits the approved ElevenLabs requests. `--dry-run` and `--live` cannot be combined. A missing key, changed plan, unreviewed manifest, failed cache check, held operator lock, or exhausted budget prevents submission.

Attempts are reserved atomically before network delivery, under a selection-wide lock. All models/phases/reference revisions of that same ordered audio selection share a 45-attempt / 1,800-audio-second ledger. A timeout or interrupted process stays charged; no hidden retry occurs. Requests stop on the first failure. `--retry` explicitly includes failed/unknown attempts in a new plan and needs a new approval hash. No stale lock file requires deletion: OS locks release when the process exits.

Saved raw successes are hashed and keyed by audio bytes plus provider/model/settings, without credentials. Raw response files and ledgers live under ignored `data/derived/benchmark/`. The adapter uses a fixed HTTPS host, refuses redirects, bounds audio and response size, and sends one request without automatic retries. Error artifacts contain fixed error codes, not provider error bodies or exception strings.

## 4. Score and inspect the smoke results

Set `LAPEACE_SMOKE_RUN` to the `run_directory` returned above:

```sh
uv run --offline python -m lapeace_data score --run-dir "$LAPEACE_SMOKE_RUN"
```

Scoring validates run/manifest/review/settings/raw hashes, reads the original `text` response, applies `en_v1`, and writes `results.jsonl`, `summary.json`, and `transcripts.csv` into that run. It makes no network requests and can be repeated without paying again. Empty successful text scores as all deletions; failed requests keep null text and scores. Cohorts use summed edits/denominators, not averaged percentages, and retain errors above 100%. Smoke cohorts without selected samples have count zero and null metrics.

After someone inspects both successful raw outputs and their scores:

```sh
uv run --offline python -m lapeace_data approve-smoke \
  --run-dir "$LAPEACE_SMOKE_RUN" --operator Murtada
```

This records inspection of the exact smoke run and computed scoring hash. It does not start or approve the full run.

## 5. Ask for full-run authorization

```sh
uv run --offline python -m lapeace_data transcribe \
  --manifest "$LAPEACE_REVIEWED_MANIFEST" --phase full --dry-run
```

Inspect the new plan and obtain separate approval. A valid inspected smoke is required. Unchanged smoke results are cached, so normally only 38 new calls remain. The approved `--phase full --live --approve-plan '<new hash>'` command then processes the remaining clips. Score its returned run directory with `score`.

Scored results are handoff data for Hisham. No `active-run.json`, measured ward ranking, or approved demo export is promoted by these commands. The census-only ward export stays unchanged. Fixtures use a separate namespace and `origin=fixture` throughout; they cannot satisfy provider smoke approval.
