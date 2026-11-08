"""Sensitivity columns for the FLEURS score files (primary CER/WER are left unchanged).
Usage: <python with opencc-python-reimplemented==0.1.7> -I sensitivity.py <results dir> <suffix e.g. _pilot or ''>
1. Chinese script: Mandarin and Cantonese reference + output both converted to Simplified (OpenCC t2s), then CER.
   Scribe returns Simplified characters for Cantonese while the FLEURS reference is Traditional.
2. Number format: flags clips where one side writes a number as digits and the other spells it out
   (e.g. "80%" vs "eighty percent"). These are excluded from the sensitivity median.
3. Latin-script words inside non-Latin languages (e.g. English loanwords in Hindi/Urdu) are counted."""
import csv, re, sys, statistics, unicodedata
from opencc import OpenCC
t2s = OpenCC('t2s')
d, sfx = sys.argv[1], sys.argv[2]
def edit(a, b):
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i]
        for j in range(1, len(b) + 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1])))
        prev = cur
    return prev[-1]
chars = lambda s: [c for c in s if not c.isspace()]
rows = list(csv.DictReader(open(f'{d}/fleurs_transcripts{sfx}.csv', encoding='utf-8-sig')))
for r in rows:
    if r['cer'] == '':
        r.update(cer_simplified_both='', number_format_mismatch='', latin_words_in_output=''); continue
    ref, hyp = r['reference_norm'], r['scribe_norm']
    if r['lang_config'] in ('cmn_hans_cn', 'yue_hant_hk'):
        rc, hc = chars(t2s.convert(ref)), chars(t2s.convert(hyp))
        r['cer_simplified_both'] = round(edit(rc, hc) / len(rc), 4)
    else:
        r['cer_simplified_both'] = ''
    rd, hd = bool(re.search(r'\d', ref)), bool(re.search(r'\d', hyp))
    r['number_format_mismatch'] = 'yes' if rd != hd else ''
    latin = re.findall(r'[A-Za-z]+', r['scribe_raw'])
    r['latin_words_in_output'] = len(latin) if r['lang_config'] in ('ur_pk','ar_eg','cmn_hans_cn','yue_hant_hk','pa_in','ta_in','hi_in','gu_in') else ''
cols = list(rows[0].keys())
with open(f'{d}/fleurs_transcripts{sfx}.csv', 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, cols); w.writeheader(); w.writerows(rows)
summ = list(csv.DictReader(open(f'{d}/fleurs_summary_by_language{sfx}.csv', encoding='utf-8-sig')))
for s in summ:
    rs = [r for r in rows if r['lang_config'] == s['lang_config'] and r['cer'] != '']
    sens = [float(r['cer'] if r['cer_simplified_both'] in ('', None) else r['cer_simplified_both']) for r in rs if not r['number_format_mismatch']]
    s['number_format_clips'] = sum(1 for r in rs if r['number_format_mismatch'])
    s['sensitivity_median_cer_pct'] = f'{statistics.median(sens)*100:.1f}' if sens else ''
    s['sensitivity_n'] = len(sens)
    s['sensitivity_method'] = ('Simplified-script CER; ' if s['lang_config'] in ('cmn_hans_cn','yue_hant_hk') else '') + 'number-format clips excluded'
    s['clips_with_latin_words'] = sum(1 for r in rs if r['latin_words_in_output'] not in ('', 0, '0'))
with open(f'{d}/fleurs_summary_by_language{sfx}.csv', 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, list(summ[0].keys())); w.writeheader(); w.writerows(summ)
for s in summ:
    print(f"{s['language']:17} n={s['scored']:>2}  medCER {s['median_cer_pct']:>5}  meanCER {s['mean_cer_pct']:>5}  medWER {s['median_wer_pct']:>5}  sens {s['sensitivity_median_cer_pct']:>5} (n={s['sensitivity_n']}, numfmt={s['number_format_clips']}, latin={s['clips_with_latin_words']})  {s['gender_counts']}")
