# Skills for Murtada's pipeline

Use the installed **`mle-workflow`** now. Keep **`speech-to-text`** for the later Scribe stage. These match the data responsibilities in [.spec.md](../../.spec.md), sections 3–6.

| Skill | Pipeline responsibility | Current use |
|---|---|---|
| [mle-workflow — affaan-m/ecc](https://skills.sh/affaan-m/ecc/mle-workflow) | Data contracts, deterministic selection, source/config hashes, evaluation and failure accounting | Installed at `.agents/skills/mle-workflow`; applied to offline preparation |
| [speech-to-text — ElevenLabs](https://skills.sh/elevenlabs/skills/speech-to-text) | Scribe request settings, raw transcripts, response provenance and error handling | Installed at `.agents/skills/speech-to-text`; reserved for explicitly authorized provider work |
| [data-quality-frameworks — wshobson/agents](https://skills.sh/wshobson/agents/data-quality-frameworks) | Additional validation and data-contract patterns | Optional candidate; not installed or applied. Great Expectations/dbt tooling adds little to this 40-clip pilot |

The skills search on November 7, 2026 found approximately 7.7K, 13.7K, and 11.7K installs respectively. Source repositories were checked through GitHub's API: approximately 299K, 539, and 42K stars. Counts are discovery signals, not proof of correctness; cached directory pages and CLI totals can differ. ElevenLabs is the official source for its transcription skill; the other two are community sources.

The first two skills already cover this milestone. If the optional quality skill becomes useful later, its install command is:

```sh
npx skills add https://github.com/wshobson/agents --skill data-quality-frameworks
```

## How the MLE workflow applies here

1. **Lock inputs:** one common English reference, stable recording IDs, read-only source, checked crosswalk and corrected census table.
2. **Make preparation repeatable:** pinned dependencies, seed `20261107`, audio/source hashes, canonical manifest hash and code provenance.
3. **Preserve missing evidence:** null predictions and metrics, explicit pending review, zero provider requests.
4. **Test consequential mistakes:** unsafe archive paths, duplicate IDs, selection drift, empty references, insertion-heavy transcripts and corpus aggregation.
5. **Review before spending credits:** audit the clips and references, then implement the bounded two-clip Scribe smoke test before any full paid pilot.

There is no training job, deployment platform, or extra model to build for this offline milestone. WER/CER compare text edits; they do not establish intent recognition, fairness, or caller legitimacy.

Next: use the [offline guide](offline.md) to locate the review queue.
