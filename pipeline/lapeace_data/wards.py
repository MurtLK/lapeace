"""Corrected census context and explicitly gated exploratory recognition indices."""

import copy
import math

from .artifacts import SCHEMA_VERSION
from .pilot import provenance


def census_context(manifest, manifest_hash, data, generated_at):
    crosswalk = {r["language"]: r["census_home_column"] for r in data["crosswalk"]}
    comparisons = manifest["selection_config"]["comparisons"]
    wards = []
    for row in sorted(data["wards"], key=lambda r: int(r["ward"])):
        counts = [(c, int(row[crosswalk[c["first_language"]]])) for c in comparisons]
        covered = sum(n for _, n in counts)
        top14 = int(row["top14_nonofficial_home_language_speakers"])
        wards.append({"ward": int(row["ward"]), "population_language_base": int(row["population_language_base"]),
                      "ward10_corrected": row["ward10_corrected"].casefold() == "true",
                      "knows_neither_english_nor_french": int(row["knows_neither_english_nor_french"]),
                      "covered_home_speakers": covered, "top14_home_speakers": top14,
                      "coverage_of_top14": covered / top14 if top14 else None,
                      "index": None, "index_status": "incomplete", "run_id": None,
                      "contributions": [{"cohort_id": c["cohort_id"], "home_speakers": n,
                                         "weight": n / covered if covered else None, "gap": None}
                                        for c, n in counts]})
    return {"schema_version": SCHEMA_VERSION, "artifact_type": "wards", "wards": wards,
            "provenance": provenance(manifest, manifest_hash, "census-context", generated_at)}


def recognition_context(manifest, manifest_hash, data, summary, run_id, *, uniform_settings):
    context = census_context(manifest, manifest_hash, data, summary["provenance"]["generated_at"])
    context["provenance"] = copy.deepcopy(summary["provenance"])
    groups = {c["cohort_id"]: c for c in summary["cohorts"]}
    expected = {c["cohort_id"] for c in manifest["cohorts"]}
    ready = (uniform_settings and summary["provenance"]["origin"] == "provider" and
             summary["run_id"] == run_id and summary["provenance"]["manifest_sha256"] == manifest_hash and
             len(summary["cohorts"]) == len(expected) and set(groups) == expected and
             len(manifest["samples"]) == 40 and all(s["review_status"] == "accepted" for s in manifest["samples"]) and
             all(c["n_selected"] == c["n_succeeded"] == 10 and c["n_failed"] == c["n_pending"] == 0 and
                 c["reference_words"] is not None and c["reference_words"] > 0 and
                 c["wer"] is not None and math.isfinite(c["wer"]) for c in groups.values()))
    if not ready:
        return context
    baseline = groups[manifest["selection_config"]["baseline"]["cohort_id"]]["wer"]
    for ward in context["wards"]:
        for contribution in ward["contributions"]:
            contribution["gap"] = min(1, max(0, groups[contribution["cohort_id"]]["wer"] - baseline))
        if ward["covered_home_speakers"]:
            ward["index"] = 100 * sum(c["home_speakers"] * c["gap"] for c in ward["contributions"]) / ward["covered_home_speakers"]
            ward["index_status"] = "ready"
            ward["run_id"] = run_id
    context["wards"].sort(key=lambda w: (w["index"] is None, -(w["index"] or 0), -w["covered_home_speakers"], w["ward"]))
    return context
