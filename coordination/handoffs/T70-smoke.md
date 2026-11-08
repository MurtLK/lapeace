# T70-smoke handoff

Owner/coordinator: Murtada. Agent: /root, Codex. No delegation.
Claim/run: `t70-smoke-20261108T050756Z`.
Workspace: `/Users/murtadalakhdar/.t3/projects/lapeace`, branch `murtada/offline-data-pipeline`.
Base commit: `f95d146f39b0bff06c39a8b2e8803796dcc68c65`; implementation changes remain local.
Status: two live responses and scoring verified; ready for human inspection. Full pilot not authorized or started.

## Authority and credentials

The user explicitly selected approval for at most two paid requests (`english247`, `urdu7`), 47.87 audio seconds, no automatic retries. A replacement credential was subsequently entered through the private secret prompt and read only inside the benchmark process. Its value and secret-file path are not recorded in repository artifacts. An earlier key pasted into chat was not used by this agent; the user was advised to revoke it. Whether that key has been revoked was not verified.

## Execution and evidence

Approved plan SHA: `01314f727019aece530c3ef4f28ac385e56e8849e671fa48a20bfacc88243c8f`.
Reviewed manifest SHA: `17602a07cbdc1538c13890c658333507de75dd1e224ee9b341e374332679fa91`.
Review SHA: `b66892ed673595d86e6c1895b2f3559a1e237dd9323150c284fd0ef04cce6321`.
Settings SHA: `a47973b096da9fb26fcc9afeb21cb632c06df5bb9c4e81b23e0ff316a9f34610`.
Run ID: `run-06e715a422685d9d3b6b2872`.
Run directory: `data/derived/benchmark/provider/c9d3d2807c7b347a041661b33368d70821456ad838e5953c12ec674f9b9c45cd/runs/run-06e715a422685d9d3b6b2872/`.

Exactly two requests were submitted to ElevenLabs with `scribe_v2` and the frozen English/verbatim settings. Both succeeded. The ledger reserves 47.866508 audio seconds across two attempts. There were no retries or failures. Both responses report detected language `eng` and contain word timing arrays. The expected request-ID headers were not exposed in either response, so `provider_request_id` remains null; raw body hashes, timestamps, audio hashes, manifest and settings identities are retained instead. No extra request was made to recover IDs.

`score` validated the recorded identities and raw-response hashes and wrote `results.jsonl`, `summary.json`, and `transcripts.csv`. Raw bodies remain in the selection's ignored `responses/` directory, with their hashes in its ledger. No audio, key, raw provider response or full result artifact was added to Git.

| Clip | Duration (s) | Word edits / reference words | WER | CER |
|---|---:|---:|---:|---:|
| saa:english247 | 20.143311 | 0 / 69 | 0 | 0 |
| saa:urdu7 | 27.723197 | 2 / 69 | 0.028985507246376812 | 0.02197802197802198 |

Raw Urdu prediction differs at `snake` → `snack`, plus insertion of `with` after `meet`. English punctuation differs but disappears under the documented normalization. These are two clip-level observations; no cohort, population, fairness, service-intent, or ward conclusions are established.

## Next gate

Show the saved transcripts/results for Murtada's inspection. No human smoke-inspection approval has been recorded yet; the agent's textual inspection does not impersonate it. Do not run the full phase on the basis of the earlier two-clip approval.

The full-phase dry run identifies 38 new requests (1114.990823 audio seconds, approximately 18 minutes 35 seconds) plus two valid cache hits, still within the original 45-attempt / 1,800-second cap. After human inspection and separate full-run authorization, record `approve-smoke` for the exact successful run, recompute the full plan, and execute only that approved plan. Scoring can then rerun offline.

## Changes/checks

- Recorded the smoke task, counts and handoff in the coordinator registry.
- Updated README's current state to reflect the two real smoke results.
- Validated both raw success bodies against saved identities and rescored without a provider call.
- The preceding implementation suite passed 80 tests; this execution introduced no source-code changes. It is live smoke evidence, not another test-suite run.
