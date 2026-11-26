"""Offline mix of a short firefight through the synthesized room response:
first-person rifle burst (round-robin variants), headshot and kill confirm,
a distant third-person rifle. Usage: python3 scripts/audio/mix-demo.py <renderDir>"""
import sys, os, wave
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root = sys.argv[1]
def load(name):
    with wave.open(os.path.join(root, name + '.wav')) as w:
        d = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32767
        x = d.reshape(-1, w.getnchannels())
    return x if x.shape[1] == 2 else np.repeat(x, 2, axis=1)
R = 48000; out = np.zeros((int(R * 3.2), 2), np.float32); send = np.zeros_like(out)
def put(sig, t, g=1.0, s=0.16, pan=0.0, lp=None):
    i = int(t * R); n = min(len(sig), len(out) - i)
    x = sig[:n] * g
    if lp:
        a = 1 - np.exp(-2 * np.pi * lp / R); y = np.zeros_like(x)
        for c in range(2):
            acc = 0.0
            for k in range(n): acc += a * (x[k, c] - acc); y[k, c] = acc
        x = y
    if pan: x = x * np.array([1 - max(0, pan), 1 + min(0, pan)])
    out[i:i + n] += x; send[i:i + n] += x * s
for k in range(5): put(load(f'rifleA-fire' if k == 0 else f'rifleA-fire-v{k % 4}' if k % 4 else 'rifleA-fire'), .1 + k / 9.75, .95)
put(load('feedback-headshot'), .1 + 4 / 9.75, .9, .12); put(load('feedback-kill'), .1 + 4 / 9.75 + .035, .75, .12)
for k in range(4): put(load('rifleA-fire-3p'), 1.6 + k / 9.75, .35, .6, pan=-.6, lp=6000)
ir = load('ir-range'); wet = np.stack([np.fft.irfft(np.fft.rfft(send[:, c], 2 * len(out)) * np.fft.rfft(ir[:, c], 2 * len(out)))[:len(out)] for c in range(2)], 1)
mix = out + wet * .9; mix /= max(1e-9, np.abs(mix).max()) / .89
with wave.open(os.path.join(root, 'mix-demo.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(R); w.writeframes((mix * 32767).astype('<i2').tobytes())
fig, ax = plt.subplots(figsize=(10, 3)); ax.specgram(mix.mean(1) + 1e-9, NFFT=1024, Fs=R, noverlap=768, cmap='magma', vmin=-95, vmax=-15); ax.set_ylim(0, 16000)
ax.set_title('Mix demo: rifle burst (variants) + headshot + kill confirm, distant rifle, range reverb', fontsize=9); fig.tight_layout(); fig.savefig(os.path.join(root, 'mix-demo.png'), dpi=90)
print('wrote mix-demo.wav/png')
