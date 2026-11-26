"""Measure rendered sounds and draw spectrogram sheets.
Usage: python3 scripts/audio/analyze.py <renderDir> [groups...]
Writes analysis.json and spectrograms-<group>.png into renderDir."""
import json, sys, wave, os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

BANDS = [(20, 150, 'sub/punch'), (150, 600, 'body'), (600, 2000, 'mid'), (2000, 6000, 'presence'), (6000, 20000, 'air')]

def load(path):
    with wave.open(path) as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        data = np.frombuffer(w.readframes(n), dtype='<i2').astype(np.float32) / 32767
    return data.reshape(-1, ch), rate

def measure(x, rate):
    m = x.mean(axis=1)
    env = np.abs(m)
    peak = env.max() + 1e-12
    i10 = np.argmax(env >= .1 * peak); i90 = np.argmax(env >= .9 * peak)
    # RMS envelope in 5 ms windows for decay measurement
    win = max(1, int(rate * .005)); frames = len(m) // win
    rms = np.sqrt(np.mean(m[:frames * win].reshape(frames, win) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms / rms.max())
    top = int(np.argmax(db)); below = np.where(db[top:] < -40)[0]
    decay40 = (below[0] if len(below) else len(db) - top) * win / rate
    spec = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
    freqs = np.fft.rfftfreq(len(m), 1 / rate)
    total = spec.sum() + 1e-20
    bands = {name: round(float(spec[(freqs >= lo) & (freqs < hi)].sum() / total), 3) for lo, hi, name in BANDS}
    centroid = float((spec * freqs).sum() / total)
    width = 0.0
    if x.shape[1] == 2:
        l, r = x[:, 0], x[:, 1]
        width = float(1 - abs(np.corrcoef(l, r)[0, 1])) if l.std() > 0 and r.std() > 0 else 0.0
    return {'attackMs': round((i90 - i10) * 1000 / rate, 2), 'decay40Ms': round(decay40 * 1000), 'centroidHz': round(centroid),
            'crestDb': round(float(20 * np.log10(peak / (np.sqrt(np.mean(m ** 2)) + 1e-12))), 1), 'stereoWidth': round(width, 3), 'bands': bands}

def main():
    root = sys.argv[1]; want = set(sys.argv[2:])
    meta = {m['name']: m for m in json.load(open(os.path.join(root, 'metrics.json')))}
    result, groups = {}, {}
    for name, m in meta.items():
        x, rate = load(os.path.join(root, name + '.wav'))
        result[name] = {**m, **measure(x, rate)}
        groups.setdefault(m['group'], []).append((name, x, rate))
    json.dump(result, open(os.path.join(root, 'analysis.json'), 'w'), indent=1)
    for group, items in groups.items():
        if want and group not in want: continue
        cols = 3; rows = (len(items) + cols - 1) // cols
        fig, axes = plt.subplots(rows, cols, figsize=(cols * 4.2, rows * 2.6), squeeze=False)
        for ax in axes.flat: ax.axis('off')
        for ax, (name, x, rate) in zip(axes.flat, items):
            ax.axis('on'); m = x.mean(axis=1)
            ax.specgram(m + 1e-9, NFFT=512, Fs=rate, noverlap=384, cmap='magma', vmin=-95, vmax=-15)
            ax.set_ylim(0, 16000); ax.set_title(f"{name}  ({result[name]['peak']} pk, {result[name]['rmsDb']} dB)", fontsize=8)
            ax.tick_params(labelsize=6)
        fig.tight_layout(); fig.savefig(os.path.join(root, f'spectrograms-{group}.png'), dpi=80); plt.close(fig)
    print(json.dumps({k: {kk: v[kk] for kk in ('seconds', 'peak', 'rmsDb', 'attackMs', 'decay40Ms', 'centroidHz', 'stereoWidth')} for k, v in result.items()}))

main()
