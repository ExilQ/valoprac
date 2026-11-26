"""Concatenate rendered sounds into one listening file (before/after A/B).
Usage: python3 scripts/audio/tour.py <renderDir> <out.wav> name[:repeat] ..."""
import sys, os, wave
import numpy as np
root, out = sys.argv[1], sys.argv[2]; R = 48000; parts = []
for spec in sys.argv[3:]:
    name, _, rep = spec.partition(':')
    path = os.path.join(root, name + '.wav')
    if not os.path.exists(path): continue
    with wave.open(path) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32).reshape(-1, w.getnchannels()) / 32767
    x = x if x.shape[1] == 2 else np.repeat(x, 2, axis=1)
    gap = .12 if 'fire' in name else .35
    for k in range(int(rep or 1)):
        parts.append(x); parts.append(np.zeros((int(R * gap), 2), np.float32))
    parts.append(np.zeros((int(R * .5), 2), np.float32))
y = np.concatenate(parts); y = (np.clip(y, -1, 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(R); w.writeframes(y.tobytes())
print(out, round(len(y) / R, 1), 's')
