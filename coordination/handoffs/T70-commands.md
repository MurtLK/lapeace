# T70-commands handoff

Owner/coordinator: Murtada. Agent/runtime: /root, Codex. No delegation used.
Claim/run: `t70-commands-20261108T040128Z`.
Workspace: `/Users/murtadalakhdar/.t3/projects/lapeace`, branch `murtada/offline-data-pipeline`.
Base SHA: `f95d146f39b0bff06c39a8b2e8803796dcc68c65`.
Status: implemented and verified locally; ready for coordinator review. No new commit or push in this task.

## Delivered behavior

- `review-import`: validates a completed 40-row review CSV, supports reasoned per-clip reference corrections, or records explicit coordinator attestation for unchanged references. Produces a new hashed manifest, preserved source references, receipt and review CSV without modifying the original pilot.
- `transcribe`: legacy pending manifests retain offline estimates and cannot run live. Reviewed manifests default to a two-clip dry-run plan. Network delivery requires `--live --approve-plan <current sha>` and a configured key. Full mode additionally requires successful smoke inspection approval.
- `approve-smoke`: records who inspected the exact raw smoke outputs and computed scores. It does not approve or trigger the full run.
- `score`: validates run/review/manifest/settings/response identities and exports results JSONL, cohort summary and transcript CSV. Original raw response text is scored with existing `en_v1` metrics, without a new provider call.
- A locked selection-wide ledger conservatively reserves attempt/time budget before requests, preserves raw successes, reuses cache hits, stops on failure, and requires explicit retry plus a new plan for failed/unknown attempts. Default caps remain 45 attempts and 1,800 seconds. Fixture namespaces cannot approve real provider runs.
- Fixed-host HTTPS multipart transport with bounded IO, no automatic retries or redirects, no reference prompting, and fixed error codes that exclude credentials/provider error bodies.

## Recorded human review

User confirmed: "My friend has done the review and it's fine." No corrections or exclusions were supplied. Recorded reviewer is `Murtada's friend (name not provided)`, attested by Murtada. The receipt timestamp records when that confirmation was imported; the original listening time is unknown. This is not agent listening approval and does not treat Buzz predictions as ground truth.

Original manifest SHA: `22373a9a40beaebc2eddcb3c4a8814b7ab3e8c194ff2388643e811546e1fb6f0` (preserved).
Reviewed manifest SHA: `17602a07cbdc1538c13890c658333507de75dd1e224ee9b341e374332679fa91`.
Review receipt SHA: `b66892ed673595d86e6c1895b2f3559a1e237dd9323150c284fd0ef04cce6321`.
Local pointer: `data/derived/reviewed-pilot.json`. It records 40 accepted samples. Original pending review records remain historical artifacts.

## Changes

Added `pipeline/lapeace_data/review.py`, `benchmark.py`, and `elevenlabs.py`; extended CLI and artifact schema loading/code provenance. Added `contracts/v1/benchmark.schema.json` without changing existing offline schema definitions. Added 26 benchmark/transport integration and regression tests. Updated `.env.example`, README, technical specification, offline guide and new benchmark guide; coordinator registry records this task.

## Verification actually run

- `uv run --offline python -m unittest discover -s tests -p 'test_*.py'`: **80 tests passed**, including the original 54 and 26 new cases. Unique synthetic audio bytes and explicitly labelled fixture transports exercise smoke → score → approval → full (38 new calls plus two cache hits) without paid requests.
- New coverage includes incomplete/duplicate/changed reviews, reference corrections, original preservation, symlink containment, tampered receipts/raw data/settings/attempts, offline default, missing key or approval, budget caps, concurrent operator lock, empty successful output, malformed responses, conservative timeout/interruption accounting, explicit retries, cache resume, and fixture/provider isolation.
- `uv run --offline python -m compileall -q pipeline/lapeace_data`: passed.
- `uv lock --check --offline`: passed. No dependency added.
- `git diff --check`: passed.
- Actual 40-clip review import and smoke-plan creation ran with Python socket creation blocked. Original media hashes were revalidated. No paid/provider call was made.

## Skill guidance and documentation

Used `mle-workflow` for immutable input/review/run identities, repeatable scoring and failure accounting, and `speech-to-text` for Scribe settings and raw-response handling. Verified the current official API reference at https://elevenlabs.io/docs/api-reference/speech-to-text/convert. The user explicitly requested credential configuration after implementation, so onboarding was deferred until this handoff instead of following the skill's before-code onboarding suggestion.

## Next operator decision

Ready smoke plan: `saa:english247` (20.143311 s) and `saa:urdu7` (27.723197 s), 47.866508 s total, maximum two new attempts, no automatic retry. Settings SHA: `a47973b096da9fb26fcc9afeb21cb632c06df5bb9c4e81b23e0ff316a9f34610`.
Plan SHA at handoff: `01314f727019aece530c3ef4f28ac385e56e8849e671fa48a20bfacc88243c8f`. Recompute before submission; changed plans require fresh approval.

Ask for secure API-key configuration through the private secret mechanism and separate approval of this two-clip plan. No live approval has been received. Provider/account availability and real response quality remain unverified. After smoke succeeds, score and inspect it, record smoke approval, then ask separately before the full pilot. New full requests should normally be 38 because smoke responses are reused.

Measured ward-index export and active-run/demo promotion remain separate unfinished work. The original offline ward export still produces corrected census context with null recognition indices. Source data, Buzz exports and generated full artifacts remain ignored; Hisham's app code and unrelated Word outputs were not changed.
