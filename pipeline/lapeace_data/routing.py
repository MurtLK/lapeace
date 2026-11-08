"""Held-out MInDS-14 intent routing. Reference-text and external-STT evidence stay separate."""

from collections import Counter, defaultdict
import csv
import hashlib
import io
import math
from pathlib import Path

from .artifacts import (SCHEMA_VERSION, atomic_write, canonical_bytes, check, code_state,
                        digest, file_hash, read_json, write_csv, write_json)
from .benchmark import exclusive
from .dataset import contained_file, relative_name, rows
from .metrics import normalize
from .pilot import inspect_media
from .review import managed, protect_source, utc_now

MINDS = "04_spoken_requests/minds14"
META = MINDS + "/metadata.csv"
MASSIVE = "04_spoken_requests/speech_massive/metadata.csv"
TYPES = "05_city_311_requests/toronto_311_request_types_2025.csv"
DIVISIONS = "05_city_311_requests/toronto_311_ward_by_division_2025.csv"
LOCALES = {"en-US": "English", "pl-PL": "Polish", "pt-PT": "Portuguese", "es-ES": "Spanish", "zh-CN": "Mandarin Chinese"}
INTENTS = sorted(["abroad", "address", "app_error", "atm_limit", "balance", "business_loan", "card_issues",
                  "cash_deposit", "direct_debit", "freeze", "high_value_payment", "joint_account", "latest_transactions", "pay_bill"])
PREDICTION_FIELDS = ["sample_id", "audio_sha256", "status", "transcript", "model_id", "settings_sha256"]
LIMITATIONS = [
    "Banking intent labels are not municipal service categories; this is a routing-method proxy, not measured 311 accuracy.",
    "Reference-text baseline bypasses speech recognition and is not end-to-end voice accuracy.",
    "Source transcriptions may contain errors; the provided English translations are never classifier inputs.",
    "Source locale is not verified spoken language: ten non-English-locale MInDS recordings are documented as English.",
    "MInDS metadata supplies no speaker IDs: exact text/audio duplicates are separated, but speaker independence cannot be verified.",
    "This is a small closed-set 14-intent nearest-example baseline, without out-of-domain validation or calibrated confidence.",
    "Language-specific example sets, sample size, speakers and recording differences limit language comparisons.",
    "Toronto 2025 service counts are contextual proxies; they do not measure Mississauga demand or map banking intents to city queues.",
    "These routing results are not merged into the accented-English ward index.",
]


def config_at(path):
    config = read_json(path)
    check(config, "RoutingConfig")
    if config["ngram_min"] > config["ngram_max"]:
        raise ValueError("Invalid character n-gram range")
    return config


def source_records(root):
    records = rows(root, META, ["file", "locale", "language", "intent", "transcription"])
    seen, result = set(), []
    for r in records:
        name = relative_name(r["file"])
        if name in seen or not name.startswith("audio/") or not name.endswith(".flac"):
            raise ValueError("Duplicate or invalid request audio path")
        seen.add(name)
        if r["locale"] not in LOCALES or r["language"] != LOCALES[r["locale"]] or r["intent"] not in INTENTS:
            raise ValueError("Unexpected MInDS locale, language or intent")
        if not normalize(r["transcription"]):
            raise ValueError("Empty normalized request transcript")
        path = contained_file(root, MINDS + "/" + name)
        with path.open("rb") as stream:
            if stream.read(4) != b"fLaC":
                raise ValueError("Request audio lacks a FLAC signature")
        result.append({"sample_id": "minds14:" + digest(name)[:24], "source_relative_path": MINDS + "/" + name,
                       "audio_sha256": file_hash(path), "locale": r["locale"], "language": r["language"],
                       "intent": r["intent"], "reference_raw": r["transcription"]})
    if {(r["locale"], r["intent"]) for r in result} != {(l, i) for l in LOCALES for i in INTENTS}:
        raise ValueError("MInDS input must cover all five locales and 14 intents")
    return sorted(result, key=lambda r: r["sample_id"])


def split_records(records, config):
    """Group equal normalized text (within locale) and identical audio (globally)."""
    parents = list(range(len(records)))

    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    keys = {}
    for i, r in enumerate(records):
        for key in (("text", r["locale"], normalize(r["reference_raw"])), ("audio", r["audio_sha256"])):
            if key in keys:
                parents[find(i)] = find(keys[key])
            else:
                keys[key] = i
    groups = defaultdict(list)
    for i, r in enumerate(records):
        groups[find(i)].append(dict(r))
    buckets, excluded = defaultdict(list), []
    for group in groups.values():
        group.sort(key=lambda r: r["sample_id"])
        gid = digest([r["sample_id"] for r in group])
        conflict = len({(r["locale"], r["intent"]) for r in group}) != 1
        for j, r in enumerate(group):
            r["group_id"] = gid
            if conflict or j:
                r.update(split="excluded", exclusion_reason="conflicting_label_or_locale" if conflict else "duplicate_text_or_audio")
                excluded.append(r)
        if not conflict:
            r = group[0]
            r["exclusion_reason"] = None
            buckets[r["locale"], r["intent"]].append(r)
    selected = []
    for locale in sorted(LOCALES):
        for intent in INTENTS:
            group = buckets[locale, intent]
            if len(group) < 3:
                raise ValueError("Each locale/intent needs at least three independent text/audio groups")
            group.sort(key=lambda r: digest([config["seed"], locale, intent, r["group_id"]]))
            cut = max(1, min(len(group)-1, int(len(group) * config["train_fraction"])))
            for i, r in enumerate(group):
                r["split"] = "train" if i < cut else "test"
                selected.append(r)
    return sorted(selected + excluded, key=lambda r: r["sample_id"])


def city_context(root):
    types = rows(root, TYPES, ["division", "section", "service_request_type", "requests_2025"])
    divisions = rows(root, DIVISIONS, ["ward", "division", "requests_2025"])
    by_type, by_ward = Counter(), Counter()
    seen = set()
    for r in types:
        key = r["division"], r["section"], r["service_request_type"]
        n = int(r["requests_2025"])
        if key in seen or n < 0:
            raise ValueError("Duplicate or invalid Toronto request type")
        seen.add(key)
        by_type[r["division"]] += n
    for r in divisions:
        n = int(r["requests_2025"])
        if n < 0:
            raise ValueError("Negative Toronto request count")
        by_ward[r["division"]] += n
    if by_type != by_ward:
        raise ValueError("Toronto type and ward/division aggregates disagree")
    massive = rows(root, MASSIVE, ["locale", "scenario", "intent", "speaker_id"])
    return {"toronto_requests_2025": sum(by_type.values()), "request_type_count": len(types),
            "top_types": [{**r, "requests_2025": int(r["requests_2025"])} for r in sorted(types, key=lambda r: (-int(r["requests_2025"]), r["service_request_type"]))[:10]],
            "speech_massive_inventory_only": {"rows": len(massive), "locales": dict(sorted(Counter(r["locale"] for r in massive).items())),
                                               "scenarios": len({r["scenario"] for r in massive}), "intents": len({r["intent"] for r in massive})},
            "interpretation": "Toronto service demand context only; no mapping from banking intent to city service is inferred."}


def put(path, value, output, definition=None):
    path = managed(path, output)
    raw = canonical_bytes(value)
    if definition:
        check(value, definition)
    if path.exists() and path.read_bytes() != raw:
        raise ValueError("Frozen routing artifact changed; refusing overwrite")
    atomic_write(path, raw)


def prepare_routing(dataset_root, output, config_path, *, origin="dataset"):
    if origin not in ("dataset", "fixture"):
        raise ValueError("Unknown routing evidence origin")
    root, output = Path(dataset_root).resolve(), Path(output).resolve()
    protect_source(output, root)
    config = config_at(config_path)
    records = split_records(source_records(root), config)
    audio_ids = []
    for locale in sorted(LOCALES):
        for intent in config["audio_pilot_intents"]:
            candidates = [r for r in records if r["split"] == "test" and r["locale"] == locale and r["intent"] == intent]
            candidates.sort(key=lambda r: digest([config["seed"], "audio", r["sample_id"]]))
            audio_ids.extend(r["sample_id"] for r in candidates[:config["audio_pilot_per_locale_intent"]])
    hashes = {n: file_hash(contained_file(root, n)) for n in [META, MASSIVE, TYPES, DIVISIONS, "README.md", "DATA_DICTIONARY.md", "LICENSES.md"]}
    manifest = {"schema_version": SCHEMA_VERSION, "artifact_type": "routing_manifest", "origin": origin, "config": config,
                "source_hashes": hashes, "records": records, "audio_pilot_ids": audio_ids,
                "context": city_context(root), "limitations": LIMITATIONS}
    folder = managed(output / "routed" / digest(manifest), output)
    with exclusive(folder):
        put(folder / "manifest.json", manifest, output, "RoutingManifest")
        stamp = folder / "preparation.json"
        if not stamp.exists():
            put(stamp, {"created_at": utc_now(), "dataset_root": str(root), "code": code_state()}, output)
        prep = read_json(contained_file(folder, "preparation.json"))
        if prep["dataset_root"] != str(root):
            raise ValueError("Existing preparation uses another source root")
        plan = folder / "audio-plan.json"
        if not plan.exists():
            media = []
            for r in records:
                if r["sample_id"] in audio_ids:
                    inspected = inspect_media(contained_file(root, r["source_relative_path"]))
                    media.append({**{k: r[k] for k in ("sample_id", "source_relative_path", "audio_sha256", "locale", "language", "intent")}, **inspected})
            put(plan, {"schema_version": SCHEMA_VERSION, "manifest_sha256": digest(manifest), "clips": media,
                       "estimated_requests_if_submitted": len(media), "audio_seconds": sum(r["duration_seconds"] for r in media),
                       "network_requests": 0, "live_authorized": False}, output)
        pilot = read_json(contained_file(folder, "audio-plan.json"))
        if pilot["manifest_sha256"] != digest(manifest) or {r["sample_id"] for r in pilot["clips"]} != set(audio_ids):
            raise ValueError("Audio plan identity mismatch")
        template = [{"sample_id": r["sample_id"], "audio_sha256": r["audio_sha256"], "status": "pending",
                     "transcript": "", "model_id": "", "settings_sha256": ""} for r in records if r["sample_id"] in audio_ids]
        target = managed(folder / "stt-import-template.csv", output)
        if not target.exists():
            write_csv(target, template, PREDICTION_FIELDS)
    return {"pilot_directory": str(folder), "source_records": len(records), "splits": dict(Counter(r["split"] for r in records)),
            "audio_pilot_clips": len(audio_ids), "audio_pilot_seconds": pilot["audio_seconds"], "network_requests": 0}


def grams(text, config):
    text = " " + normalize(text) + " "
    return Counter(text[i:i+n] for n in range(config["ngram_min"], config["ngram_max"]+1) for i in range(len(text)-n+1))


class ExampleRouter:
    """Training text only; IDs, filenames, gold test labels and translations never become features."""

    def __init__(self, training, config):
        self.config = config
        self.training = training
        counts = [grams(r["reference_raw"], config) for r in training]
        frequency = Counter(g for counts_per_doc in counts for g in counts_per_doc)
        self.idf = {g: math.log((1+len(training))/(1+n))+1 for g, n in frequency.items()}
        self.index = defaultdict(list)
        for i, counts_per_doc in enumerate(counts):
            for g, weight in self.vector(counts_per_doc).items():
                self.index[g].append((i, weight))

    def vector(self, counts):
        vector = {g: (1+math.log(n))*self.idf[g] for g, n in counts.items() if g in self.idf}
        length = math.sqrt(sum(x*x for x in vector.values()))
        return {g: x/length for g, x in vector.items()} if length else {}

    def predict(self, text):
        scores = defaultdict(float)
        for gram, weight in self.vector(grams(text, self.config)).items():
            for i, other in self.index.get(gram, []):
                scores[i] += weight*other
        best = {}
        for i, similarity in scores.items():
            row = self.training[i]
            candidate = (min(1.0, similarity), row["sample_id"])
            if row["intent"] not in best or candidate > best[row["intent"]]:
                best[row["intent"]] = candidate
        ranking = sorted(best, key=lambda label: (-best[label][0], label))
        similarity = best[ranking[0]][0] if ranking else 0
        margin = similarity - (best[ranking[1]][0] if len(ranking)>1 else 0)
        label = ranking[0] if ranking and similarity >= self.config["min_similarity"] and margin >= self.config["min_margin"] else None
        return {"predicted_intent": label, "decision": "route" if label else "clarify",
                "similarity": similarity, "margin": margin,
                "matched_example_id": best[ranking[0]][1] if ranking else None}


def intent_metrics(results):
    matrix = {i: {p: 0 for p in [*INTENTS, "__clarify__", "__provider_failure__"]} for i in INTENTS}
    for r in results:
        column = r["predicted_intent"] or ("__provider_failure__" if r["decision"] == "provider_failure" else "__clarify__")
        matrix[r["expected_intent"]][column] += 1
    correct = sum(matrix[i][i] for i in INTENTS)
    routed = sum(r["decision"] == "route" for r in results)
    support = Counter(r["expected_intent"] for r in results)
    f1 = []
    for intent in sorted(support):
        tp = matrix[intent][intent]
        predicted = sum(matrix[i][intent] for i in INTENTS)
        f1.append(2*tp/(support[intent]+predicted) if support[intent]+predicted else 0)
    n = len(results)
    return {"n": n, "correct": correct, "wrong_route": routed-correct,
            "clarify": sum(r["decision"] == "clarify" for r in results),
            "provider_failed": sum(r["decision"] == "provider_failure" for r in results),
            "accuracy": correct/n if n else None, "routing_coverage": routed/n if n else None,
            "accuracy_when_routed": correct/routed if routed else None,
            "macro_f1": sum(f1)/len(f1) if f1 else None, "macro_f1_labels": sorted(support), "confusion": matrix}


def load_routing(folder, output):
    folder = managed(folder, output)
    manifest = read_json(contained_file(folder, "manifest.json"))
    check(manifest, "RoutingManifest")
    if folder != Path(output).resolve() / "routed" / digest(manifest):
        raise ValueError("Routing manifest identity mismatch")
    prep = read_json(contained_file(folder, "preparation.json"))
    root = Path(prep["dataset_root"])
    protect_source(output, root)
    for name, sha in manifest["source_hashes"].items():
        if file_hash(contained_file(root, name)) != sha:
            raise ValueError("Routing source table changed")
    original = source_records(root)
    if split_records(original, manifest["config"]) != manifest["records"]:
        raise ValueError("Routing audio, text, labels or split changed")
    return folder, manifest, prep


def score_routing(pilot_dir, output, predictions_csv=None):
    output = Path(output).resolve()
    folder, manifest, prep = load_routing(pilot_dir, output)
    with exclusive(folder):
        imported, raw, profile = None, None, None
        if predictions_csv:
            raw = Path(predictions_csv).read_bytes()
            reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig"), newline=""))
            if reader.fieldnames != PREDICTION_FIELDS:
                raise ValueError("STT import headers must match stt-import-template.csv")
            imported = {}
            for r in reader:
                if (None in r or any(v is None for v in r.values()) or r["sample_id"] in imported or
                        r["status"] not in ("succeeded", "failed") or not r["model_id"].strip() or
                        len(r["settings_sha256"]) != 64 or any(c not in "0123456789abcdef" for c in r["settings_sha256"])):
                    raise ValueError("Invalid, pending or duplicate STT import row")
                if r["status"] == "failed" and r["transcript"]:
                    raise ValueError("Failed STT must not carry a successful transcript")
                imported[r["sample_id"]] = r
            if set(imported) != set(manifest["audio_pilot_ids"]):
                raise ValueError("STT import must cover exactly the frozen audio pilot")
            profile = sorted({(r["model_id"], r["settings_sha256"]) for r in imported.values()})
            if len({r["model_id"] for r in imported.values()}) != 1:
                raise ValueError("Audio comparison needs one model throughout")
            for locale in LOCALES:
                locale_ids = {r["sample_id"] for r in manifest["records"] if r["locale"] == locale}
                if len({r["settings_sha256"] for sid, r in imported.items() if sid in locale_ids}) != 1:
                    raise ValueError("Settings must be consistent within each locale")
        mode = "external_stt_routing" if imported is not None else "reference_text_baseline"
        identity = {"manifest_sha256": digest(manifest), "mode": mode,
                    "stt_csv_sha256": hashlib.sha256(raw).hexdigest() if raw is not None else None,
                    "code_sha256": code_state()["source_tree_sha256"]}
        run_id = "routing-" + digest(identity)[:24]
        run_dir = managed(folder / "runs" / run_id, output)
        models = {locale: ExampleRouter([r for r in manifest["records"] if r["split"] == "train" and r["locale"] == locale], manifest["config"]) for locale in LOCALES}
        results = []
        for r in manifest["records"]:
            if r["split"] != "test" or (imported is not None and r["sample_id"] not in imported):
                continue
            reference_decision = models[r["locale"]].predict(r["reference_raw"])
            source = imported[r["sample_id"]] if imported is not None else None
            if source is not None and source["audio_sha256"] != r["audio_sha256"]:
                raise ValueError("Imported STT is bound to another audio clip")
            text = source["transcript"] if source is not None else r["reference_raw"]
            prediction = (models[r["locale"]].predict(text) if source is None or source["status"] == "succeeded" else
                          {"predicted_intent": None, "decision": "provider_failure", "similarity": None, "margin": None, "matched_example_id": None})
            results.append({"sample_id": r["sample_id"], "locale": r["locale"], "language": r["language"],
                            "expected_intent": r["intent"], "reference_raw": r["reference_raw"], "router_input_raw": text,
                            **prediction, "correct": prediction["predicted_intent"] == r["intent"],
                            "reference_predicted_intent": reference_decision["predicted_intent"],
                            "reference_correct": reference_decision["predicted_intent"] == r["intent"]})
            check(results[-1], "RoutingResult")
        locales = []
        for locale, language in sorted(LOCALES.items()):
            selected = [r for r in results if r["locale"] == locale]
            locales.append({"locale": locale, "language": language, **intent_metrics(selected),
                            "reference_accuracy_same_examples": sum(r["reference_correct"] for r in selected)/len(selected) if selected else None})
        summary = {"schema_version": SCHEMA_VERSION, "artifact_type": "routing_summary", "run_id": run_id,
                   "mode": mode, "origin": manifest["origin"], "identity": identity, "overall": intent_metrics(results), "locales": locales,
                   "reference_overall_same_examples": intent_metrics([{**r, "predicted_intent": r["reference_predicted_intent"],
                        "decision": "route" if r["reference_predicted_intent"] else "clarify"} for r in results]),
                   "paired_outcomes": dict(Counter(("both_correct" if r["correct"] and r["reference_correct"] else
                        "reference_correct_stt_wrong" if r["reference_correct"] else
                        "reference_wrong_stt_correct" if r["correct"] else "both_wrong") for r in results)),
                   "stt_profiles": profile, "network_requests": 0, "limitations": LIMITATIONS,
                   "attribution": ["MInDS-14: PolyAI, Gerz et al. (2021), CC BY 4.0; https://huggingface.co/datasets/PolyAI/minds14",
                                   "Toronto Open Data 311 2025, Open Government Licence - Toronto; context only."]}
        check(summary, "RoutingSummary")
        put(run_dir / "summary.json", summary, output, "RoutingSummary")
        run_path = managed(run_dir / "run.json", output)
        run = read_json(run_path) if run_path.exists() else {"schema_version": SCHEMA_VERSION, "run_id": run_id, "identity": identity,
                                                            "created_at": utc_now(), "code": code_state()}
        if run["identity"] != identity or run["code"]["source_tree_sha256"] != identity["code_sha256"]:
            raise ValueError("Routing run provenance changed")
        put(run_path, run, output)
        result_bytes = b"".join(canonical_bytes(r) for r in results)
        target = managed(run_dir / "results.jsonl", output)
        if target.exists() and target.read_bytes() != result_bytes:
            raise ValueError("Stored routing result changed")
        atomic_write(target, result_bytes)
        if results:
            write_csv(managed(run_dir / "results.csv", output), results, list(results[0]))
        if raw is not None:
            target = managed(run_dir / "stt-input.csv", output)
            if target.exists() and target.read_bytes() != raw:
                raise ValueError("Stored STT import changed")
            atomic_write(target, raw)
        return {"run_directory": str(run_dir), "run_id": run_id, "mode": mode, "evaluated_requests": len(results),
                "network_requests": 0, "summary": summary}


def import_routing_buzz(pilot_dir, buzz_dir, model_id, settings_json, output):
    """Bind unedited neutral-filename Buzz exports to the frozen audio pilot, then score offline."""
    output, buzz_dir = Path(output).resolve(), Path(buzz_dir).resolve()
    folder, manifest, _ = load_routing(pilot_dir, output)
    if not isinstance(model_id, str) or not model_id.strip():
        raise ValueError("Record the actual Buzz model identifier")
    settings_raw = Path(settings_json).read_bytes()
    import json
    settings = json.loads(settings_raw)
    if not isinstance(settings, dict) or not settings:
        raise ValueError("Record the actual nonempty Buzz settings object")
    selected = [r for r in manifest["records"] if r["sample_id"] in manifest["audio_pilot_ids"]]
    blobs, records, exports = {}, [], []
    for r in selected:
        stem = r["sample_id"].replace(":", "_")
        candidates = [p for p in buzz_dir.iterdir() if p.is_file() and p.suffix == ".txt" and
                      (p.name == stem + ".txt" or p.name.startswith(stem + " (transcribed on "))]
        if len(candidates) != 1 or candidates[0].is_symlink():
            raise ValueError("Need exactly one original Buzz text export per neutral sample filename")
        path = candidates[0]
        raw = path.read_bytes()
        text = raw.decode("utf-8-sig")
        blobs[stem + ".txt"] = raw
        exports.append({"sample_id": r["sample_id"], "filename": path.name,
                        "raw_sha256": hashlib.sha256(raw).hexdigest(), "audio_sha256": r["audio_sha256"]})
        records.append({"sample_id": r["sample_id"], "audio_sha256": r["audio_sha256"], "status": "succeeded",
                        "transcript": text, "model_id": model_id, "settings_sha256": digest(settings)})
    ident = {"manifest_sha256": digest(manifest), "model_id": model_id, "settings": settings, "exports": exports}
    imported = managed(folder / "buzz-imports" / digest(ident), output)
    with exclusive(imported):
        for name, raw in {**blobs, "settings-original.json": settings_raw}.items():
            path = managed(imported / "inputs" / name, output)
            if path.exists() and path.read_bytes() != raw:
                raise ValueError("Stored original Buzz input changed")
            atomic_write(path, raw)
        put(imported / "receipt.json", {"schema_version": SCHEMA_VERSION, "origin": manifest["origin"],
                                        "identity": ident, "network_requests": 0}, output)
        csv_path = managed(imported / "stt-input.csv", output)
        stream = io.StringIO(newline="")
        writer = csv.DictWriter(stream, PREDICTION_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(records)
        raw = stream.getvalue().encode("utf-8")
        if csv_path.exists() and csv_path.read_bytes() != raw:
            raise ValueError("Stored Buzz STT conversion changed")
        atomic_write(csv_path, raw)
    result = score_routing(folder, output, csv_path)
    return {**result, "buzz_import_directory": str(imported), "stt_input_csv": str(csv_path)}
