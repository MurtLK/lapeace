# T80-checklist handoff

Human owner/coordinator: Murtada. Agent/runtime: `/root`, Codex. No delegation.
Claim/run: `t80-checklist-20261108`.
Checkout: `/Users/murtadalakhdar/.t3/projects/lapeace`, branch `murtada/offline-data-pipeline`.
Base commit: `ca9e6f4ca5defc99a1c6949148e94388b666c6f2`.
Status: documentation completed for coordinator review. No application implementation was started.

## Delivered

Added `docs/release-checklist.md` and linked it from README. It distinguishes verified pipeline work from remaining or unverified application work, assigns owners using the user's current team allocation, and gives acceptance checks for evidence, ward context, reviewed service scenarios, ElevenLabs STT/TTS interaction, replay, integration and presentation/submission. The exact Buzz run and handoff guide are referenced; additional transcription is not a prerequisite.

This checkout has neither `web/` nor `server/`, and has no approved `active-run.json`. Hisham may have an application elsewhere; the checklist requires bringing in his branch/PR and verifying integration, not asserting that his work is absent everywhere. Existing registry planning states were not treated as actual app implementation evidence.

Corrected the supplied plan's recognition/TTS distinction and separated transcript edit metrics from intent understanding. Kept a ward table in foundation scope and maps/neighbourhood analysis optional. Preserved current product scope, honest model metadata, reference attribution and exploratory-index limitations.

## Requested user-local setup

Read the OpenAI Docs and plugin-management skills. The connected plugin manager has no Git-marketplace registration operation, so used the installed Codex CLI. Inspected current CLI help and the requested repository's README, and checked official OpenAI marketplace documentation.

Executed `codex plugin marketplace add nykooi1/vibe-wise` successfully. `codex plugin marketplace list` then listed `vibe-wise`. This registers the marketplace only. Did not install or activate the plugin or learning mode, since the user explicitly requested marketplace addition. The checklist provides `codex plugin add vibe-wise@vibe-wise` and the repository's new-session/learning-mode instructions as a separate step. No plugin-specific permissions, external account connections or project runtime dependencies were added.

## Verification and boundaries

- Inspected repository status/files, PRD/spec, task registry, pipeline handoff and actual artifact-selection availability.
- Verified marketplace registration through CLI output.
- Checked modified Markdown relative links and task JSON parsing; ran `git diff --check`.
- No code, audio, model requests, schema or application changes. No new tests were needed for this documentation-only change; the preceding implementation's 89 passing tests remain historical evidence, not a rerun claim.
- Preserved unrelated untracked `output/` files. Runtime data and user-local plugin configuration remain outside the Git changes.

Sources: https://github.com/nykooi1/vibe-wise#codex and https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli.
