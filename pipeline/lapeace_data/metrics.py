"""Pure en_v1 metric functions; no synthetic outputs enter real pilot results."""

import unicodedata


def normalize(text):
    text = unicodedata.normalize("NFC", text).casefold()
    text = "".join(" " if unicodedata.category(c).startswith("P") else c for c in text)
    return " ".join(text.split())


def edit_distance(reference, prediction):
    previous = list(range(len(prediction) + 1))
    for i, token in enumerate(reference, 1):
        current = [i]
        for j, other in enumerate(prediction, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (token != other)))
        previous = current
    return previous[-1]


def score(reference, prediction):
    ref, pred = normalize(reference), normalize(prediction)
    if not ref:
        raise ValueError("Empty normalized reference")
    ref_words, pred_words = ref.split(), pred.split()
    ref_chars, pred_chars = "".join(ref.split()), "".join(pred.split())
    words, chars = edit_distance(ref_words, pred_words), edit_distance(ref_chars, pred_chars)
    return {"word_edits": words, "reference_words": len(ref_words),
            "character_edits": chars, "reference_characters": len(ref_chars),
            "wer": words / len(ref_words), "cer": chars / len(ref_chars)}


def aggregate(results):
    successful = [r for r in results if r["status"] == "succeeded"]
    totals = {key: sum(r[key] for r in successful) if successful else None for key in
              ["word_edits", "reference_words", "character_edits", "reference_characters"]}
    return {**totals, "n_selected": len(results), "n_succeeded": len(successful),
            "n_failed": sum(r["status"] == "failed" for r in results),
            "n_pending": sum(r["status"] == "pending" for r in results),
            "wer": totals["word_edits"] / totals["reference_words"] if successful else None,
            "cer": totals["character_edits"] / totals["reference_characters"] if successful else None}
