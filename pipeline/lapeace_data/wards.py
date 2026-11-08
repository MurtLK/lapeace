"""Census context only. Recognition indices remain unavailable offline."""

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
