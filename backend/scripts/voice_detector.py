"""Prototype synthetic-voice detector (numpy only at predict time).

  python -I voice_detector.py build <human_wav_dir> <synthetic_wav_dir> <out model.json>   (needs scikit-learn)
  python -I voice_detector.py predict <model.json> <file.wav>                               (numpy only; prints JSON)

Human = real recordings (Speech Accent Archive + FLEURS). Synthetic = macOS system voices (27 voices,
3 families). Both classes get the same random noise / phone-band / reverb / gain augmentation so the
model cannot just learn "clean studio audio = synthetic". Evaluated on HELD-OUT voices and speakers,
plus a harder test: train on older voice families, test on the newest voices it never saw.
It has never seen modern neural voice clones (e.g. ElevenLabs), so its score is a prototype signal only.
"""
import json, sys, wave, glob, os, re
import numpy as np

SR = 16000; NFFT = 512; HOP = 160; NMEL = 40; MAXSEC = 8

def load(path):
    with wave.open(path, 'rb') as w:
        assert w.getsampwidth() == 2, 'need 16-bit PCM'
        sr, ch = w.getframerate(), w.getnchannels()
        if not (4000 <= sr <= 48000) or not (1 <= ch <= 2): raise ValueError('unsupported wav format')
        nf = min(w.getnframes(), sr * 60)  # cap BEFORE decoding: at most 60 s
        x = np.frombuffer(w.readframes(nf), dtype='<i2').astype(np.float32) / 32768.0
    if ch > 1: x = x.reshape(-1, ch).mean(1)
    if sr != SR: x = np.interp(np.arange(0, len(x), sr / SR), np.arange(len(x)), x).astype(np.float32)
    return x

def trim(x):
    f = len(x) // HOP
    if f < 10: return x
    e = np.sqrt((x[: f * HOP].reshape(f, HOP) ** 2).mean(1) + 1e-12)
    on = np.where(e > max(e.max() * 0.03, 1e-4))[0]
    if len(on) == 0: return x
    return x[on[0] * HOP: (on[-1] + 1) * HOP]

def mel_fb():
    hz = lambda m: 700 * (10 ** (m / 2595) - 1); mel = lambda h: 2595 * np.log10(1 + h / 700)
    pts = hz(np.linspace(mel(50), mel(7600), NMEL + 2)); bins = np.floor((NFFT + 1) * pts / SR).astype(int)
    fb = np.zeros((NMEL, NFFT // 2 + 1))
    for i in range(NMEL):
        a, b, c = bins[i], bins[i + 1], bins[i + 2]
        for k in range(a, b): fb[i, k] = (k - a) / max(1, b - a)
        for k in range(b, c): fb[i, k] = (c - k) / max(1, c - b)
    return fb
FB = mel_fb(); WIN = np.hanning(NFFT).astype(np.float32); FREQS = np.fft.rfftfreq(NFFT, 1 / SR)

def features(x):
    x = x - x.mean(); x = x / (np.abs(x).max() + 1e-9) * 0.5
    if len(x) < NFFT * 4: x = np.pad(x, (0, NFFT * 4 - len(x)))
    n = 1 + (len(x) - NFFT) // HOP
    frames = np.lib.stride_tricks.as_strided(x, (n, NFFT), (x.strides[0] * HOP, x.strides[0])) * WIN
    P = np.abs(np.fft.rfft(frames, axis=1)) ** 2 + 1e-10
    lm = np.log(P @ FB.T + 1e-10)
    en = np.log(P.sum(1)); speech = en > np.percentile(en, 30)
    lms = lm[speech] if speech.sum() > 10 else lm
    d = np.diff(lms, axis=0)
    flat = np.exp(np.log(P).mean(1)) / P.mean(1)
    cen = (P * FREQS).sum(1) / P.sum(1)
    cum = np.cumsum(P, 1); roll = FREQS[(cum < 0.85 * cum[:, -1:]).sum(1).clip(0, len(FREQS) - 1)]
    hf = P[:, FREQS > 4000].sum(1) / P.sum(1)
    zc = (np.abs(np.diff(np.sign(frames), axis=1)) > 0).mean(1)
    de = np.diff(en)
    return np.concatenate([lms.mean(0) - lms.mean(), lms.std(0), np.abs(d).mean(0), d.std(0),
        [flat[speech].mean(), flat[speech].std(), cen[speech].mean() / 4000, cen[speech].std() / 4000, roll[speech].mean() / 8000,
         hf[speech].mean(), zc[speech].mean(), zc[speech].std(), en.std(), np.abs(de).mean(), de.std(), (~speech).mean(),
         np.corrcoef(lms[:-1].mean(1), lms[1:].mean(1))[0, 1] if len(lms) > 3 else 0]]).astype(np.float32)

def augment(x, rng):
    x = x.copy()
    if rng.random() < 0.5:  # phone band 300-3400 Hz
        X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X[(f < 300) | (f > 3400)] *= 0.05; x = np.fft.irfft(X, len(x)).astype(np.float32)
    if rng.random() < 0.4:  # small room reverb
        L = int(SR * rng.uniform(0.08, 0.3)); ir = rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 5)); ir[0] = 1; ir /= np.abs(ir).sum() ** 0.5
        x = np.convolve(x, ir)[: len(x)].astype(np.float32)
    if rng.random() < 0.8:  # background noise at 12-40 dB SNR
        snr = rng.uniform(12, 40); p = (x ** 2).mean() + 1e-12; x = x + rng.standard_normal(len(x)).astype(np.float32) * np.sqrt(p / 10 ** (snr / 10))
    return x * rng.uniform(0.3, 1.0)

def crop(x, rng=None):
    L = SR * MAXSEC
    if len(x) <= L: return x
    s = rng.integers(0, len(x) - L) if rng is not None else (len(x) - L) // 2
    return x[s: s + L]

FAMILY = {'modern': ['Daniel', 'Karen', 'Moira', 'Rishi', 'Samantha', 'Tessa'], 'classic': ['Albert', 'Fred', 'Junior', 'Kathy', 'Ralph']}
def family(name):
    v = name.split('__')[0]
    for fam, vs in FAMILY.items():
        if any(v.startswith(x) for x in vs): return fam
    return 'eloquence'

def build(hum_dir, syn_dir, out):
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import roc_auc_score
    rng = np.random.default_rng(7)
    items = [(p, 0, 'h:' + re.sub(r'\d+$', '', os.path.basename(p)[:-4]) if '_' in os.path.basename(p) and os.path.basename(p)[:2] in ('ar', 'cm', 'en', 'es', 'fi', 'gu', 'hi', 'pa', 'pl', 'pt', 'ta', 'ur', 'vi', 'yu') and os.path.basename(p)[2] == '_' else 'h:' + os.path.basename(p)[:-4], 'human') for p in sorted(glob.glob(f'{hum_dir}/*.wav'))]
    items += [(p, 1, 's:' + os.path.basename(p).split('__')[0], family(os.path.basename(p))) for p in sorted(glob.glob(f'{syn_dir}/*.wav'))]
    X, y, g, fam = [], [], [], []
    for p, lab, grp, f in items:
        x = trim(load(p))
        for k in range(3):  # 3 augmented crops per clip; every copy is augmented (no clean shortcut)
            X.append(features(augment(crop(x, rng), rng))); y.append(lab); g.append(grp); fam.append(f)
    X, y, g, fam = np.array(X), np.array(y), np.array(g), np.array(fam)
    X = np.nan_to_num(X)
    def fit(tr):
        sc = StandardScaler().fit(X[tr]); m = LogisticRegression(C=0.3, max_iter=3000, class_weight='balanced').fit(sc.transform(X[tr]), y[tr]); return sc, m
    # 1) 5-fold, grouped by voice / speaker: test voices never seen in training
    groups = np.unique(g); rng.shuffle(groups); folds = np.array_split(groups, 5)
    pr = np.zeros(len(y))
    for fg in folds:
        te = np.isin(g, fg); sc, m = fit(~te); pr[te] = m.predict_proba(sc.transform(X[te]))[:, 1]
    res = {'heldout_voices': {'auc': round(float(roc_auc_score(y, pr)), 3), 'accuracy': round(float(((pr > 0.5) == y).mean()), 3),
           'human_flagged_as_synthetic': round(float((pr[y == 0] > 0.5).mean()), 3), 'synthetic_caught': round(float((pr[y == 1] > 0.5).mean()), 3)}}
    # 2) harder: train on classic + eloquence voices, test on the 6 newest voices (+ held-out humans)
    hg = np.unique(g[y == 0]); rng.shuffle(hg); hte = hg[: len(hg) // 4]
    te = (fam == 'modern') | np.isin(g, hte); tr = ~te & (fam != 'modern')
    sc, m = fit(tr); p2 = m.predict_proba(sc.transform(X[te]))[:, 1]; yt = y[te]
    res['unseen_newer_voices'] = {'auc': round(float(roc_auc_score(yt, p2)), 3), 'accuracy': round(float(((p2 > 0.5) == yt).mean()), 3),
        'synthetic_caught': round(float((p2[yt == 1] > 0.5).mean()), 3), 'human_flagged_as_synthetic': round(float((p2[yt == 0] > 0.5).mean()), 3),
        'trained_on': 'older macOS voice families', 'tested_on': ', '.join(FAMILY['modern'])}
    sc, m = fit(np.ones(len(y), bool))
    model = {'kind': 'logistic_regression', 'mean': sc.mean_.tolist(), 'scale': sc.scale_.tolist(), 'coef': m.coef_[0].tolist(), 'intercept': float(m.intercept_[0]),
             'trained_on': {'human_clips': int((np.array([i[1] for i in items]) == 0).sum()), 'synthetic_clips': int((np.array([i[1] for i in items]) == 1).sum()),
                            'synthetic_voices': int(len(np.unique(g[y == 1]))), 'augmented_copies_per_clip': 3},
             'evaluation': res}
    json.dump(model, open(out, 'w'), indent=1)
    print(json.dumps(model['trained_on']), json.dumps(res, indent=1))

def predict(model_path, wav):
    m = json.load(open(model_path))
    x = features(crop(trim(load(wav))))
    z = (np.nan_to_num(x) - np.array(m['mean'])) / np.array(m['scale'])
    p = 1 / (1 + np.exp(-(z @ np.array(m['coef']) + m['intercept'])))
    ev = m['evaluation']
    print(json.dumps({'p_synthetic': round(float(p), 3),
        'caveat': f"Prototype trained on {m['trained_on']['synthetic_voices']} built-in computer voices vs real recordings. On voices it never saw it scored "
                  f"AUC {ev['heldout_voices']['auc']}; on newer voices from an unseen family it caught {round(ev['unseen_newer_voices']['synthetic_caught'] * 100)}%. "
                  "It has never seen modern AI voice clones, so treat it as a hint. The red flags above are what decide the verdict."}))

if __name__ == '__main__':
    if sys.argv[1] == 'build': build(*sys.argv[2:5])
    elif sys.argv[1] == 'predict': predict(*sys.argv[2:4])
