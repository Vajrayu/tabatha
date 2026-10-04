"""Tabatha showreel score + SFX, synthesized. 120 BPM, 10 s, F minor chiptune-ish.
Writes audio/score.wav (-14 LUFS) and beats.json (beat grid measured from the kick stem)."""
import json, os
import numpy as np, pyloudnorm as pyln
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR, DUR, BPM = 48000, 10.0, 120
B = 60 / BPM                      # 0.5 s per beat
N = int(SR * DUR)
rng = np.random.default_rng(7)    # seeded noise only
os.makedirs('audio', exist_ok=True)

def t_(d): return np.arange(int(SR * d)) / SR
def env(d, a=0.002, r=None, curve=6.0):
    t = t_(d); e = np.exp(-curve * t / d) if r is None else np.exp(-t / r)
    att = np.minimum(1, t / max(a, 1e-4)); return e * att
def place(buf, sig, at, gain=1.0):
    i = int(at * SR); j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += sig[: j - i] * gain
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(SR * d))
def pulse(f, d, duty=0.25):
    ph = (np.cumsum(np.full(int(SR * d), f) / SR)) % 1.0
    return np.where(ph < duty, 1.0, -1.0)
def saw(f, d):
    ph = (np.cumsum(np.full(int(SR * d), f) / SR)) % 1.0; return 2 * ph - 1
def hz(n): return 440 * 2 ** ((n - 69) / 12)

# ---------------- instruments
def kick(big=False):
    d = 0.45 if big else 0.32; t = t_(d)
    f = 48 + 120 * np.exp(-t * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * env(d, r=0.16 if big else 0.11) + 0.4 * lp(noise(d), 3000) * env(d, r=0.004)
    return np.tanh(s * 2.2) * 0.9
def snare():
    d = 0.25; n = bp(noise(d), 900, 7000) * env(d, r=0.06)
    tone = np.sin(2 * np.pi * 190 * t_(d)) * env(d, r=0.04)
    return (n * 0.8 + tone * 0.5)
def hat(open_=False):
    d = 0.18 if open_ else 0.05; return hp(noise(d), 7000) * env(d, r=0.05 if open_ else 0.012) * 0.35
def bass(n, d):
    s = 0.6 * saw(hz(n), d) + 0.5 * pulse(hz(n - 12), d, 0.5)
    return lp(s, 900) * env(d, a=0.003, r=d * 0.9) * 0.55
def pluck(n, d=0.12, duty=0.25):
    return pulse(hz(n), d, duty) * env(d, r=0.05) * 0.16
def pad(ns, d):
    s = sum(saw(hz(n) * (1 + dt), d) for n in ns for dt in (-0.004, 0.004)) / (2 * len(ns))
    e = np.minimum(1, t_(d) / 0.05) * np.minimum(1, (d - t_(d)) / 0.3).clip(0, 1)
    return lp(s, 2200) * e * 0.22
def click():   # UI click: short, bright
    d = 0.035; return (bp(noise(d), 2000, 9000) * env(d, r=0.004) * 0.9 + np.sin(2 * np.pi * 3200 * t_(d)) * env(d, r=0.006) * 0.4)
def key():     # keycap thock
    d = 0.07; t = t_(d)
    return (bp(noise(d), 800, 5000) * env(d, r=0.008) * 0.8 + np.sin(2 * np.pi * (420 - 1500 * t) * t) * env(d, r=0.02) * 0.6)
def tick(n):   # card pop
    return pulse(hz(n), 0.05, 0.5) * env(0.05, r=0.015) * 0.18
def whoosh(d, up=True):
    t = t_(d); x = noise(d); out = np.zeros_like(x); step = int(SR * 0.01)
    for i in range(0, len(x), step):   # swept bandpass in 10 ms blocks
        k = i / len(x); f = 300 + (5000 if up else 5000 * (1 - k)) * (k if up else 1)
        seg = x[max(0, i - 400): i + step]
        out[i:i + step] = bp(seg, max(80, f * 0.6), min(20000, f * 1.6))[-len(out[i:i + step]):]
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2 if not up else (t / d) ** 2
    return out * e * 0.6
music = np.zeros(N); sfx = np.zeros(N); kicks = np.zeros(N)

# ---------------- structure (seconds)
HOOK = [0.0, 0.25, 0.5, 0.75, 1.0]          # five words
PROD, F1, F2, F3, MET, END = 1.5, 3.0, 4.5, 6.0, 7.5, 8.75
prog = [(53, [65, 68, 72]), (49, [65, 68, 73]), (56, [63, 68, 72]), (51, [63, 67, 70])]   # Fm Db Ab Eb (roots as MIDI bass)

# Hook: stabs on each word, rising pitch
for i, at in enumerate(HOOK):
    place(kicks, kick(i == 4), at)
    place(music, pad([65 + i, 68 + i, 72 + i], 0.22), at, 1.6)
    place(music, snare(), at, 0.35 if i < 4 else 0.7)
place(sfx, whoosh(0.5, True), 1.0, 0.9)
# Groove from PROD to END (four on the floor)
for b in range(int(PROD / B), int(END / B)):
    at = b * B
    place(kicks, kick(at in (PROD, F1, MET)), at)
    if b % 2 == 1: place(music, snare(), at, 0.55)
    place(music, hat(True), at + B / 2, 0.8)
    for s in range(4): place(music, hat(), at + s * B / 4, 0.6)
    root, ch = prog[(b // 2) % 4]
    for e8 in range(2): place(music, bass(root - 12 + (12 if e8 else 0), B / 2), at + e8 * B / 2)
    if b % 2 == 0: place(music, pad(ch, 2 * B), at, 1.0)
    for s in range(4):   # chip arp, 16ths
        place(music, pluck(ch[(b * 4 + s) % 3] + 12 + (12 if s == 3 else 0)), at + s * B / 4, 1.0)
# metric section: drop the hats for the first beat (space), keep kick
# ending: big chord + tail
place(kicks, kick(True), END)
place(music, pad([65, 68, 72, 77], 1.25), END, 1.4)
place(music, bass(41, 1.25), END, 1.0)
for i, n in enumerate([77, 80, 84, 89]): place(music, pluck(n, 0.3, 0.125), END + 0.25 + i * 0.125, 1.2)

# ---------------- SFX on the grid
place(sfx, whoosh(0.25, False), PROD - 0.02, 0.8)
place(sfx, key(), 1.875); place(sfx, key(), 2.0, 1.2)                  # Alt, Q
for i, at in enumerate([2.125, 2.25, 2.375, 2.5, 2.625, 2.75]): place(sfx, tick(84 + i * 2), at)
for at in (3.25, 3.5, 3.75): place(sfx, key(), at, 1.1)                 # Q taps (cycle)
place(sfx, whoosh(0.4, False), F1 - 0.05, 0.6)
place(sfx, click(), F2)                                                 # click search
for at in (4.75, 4.875, 5.0, 5.125, 5.25): place(sfx, key(), at, 0.8)   # n o r t h
place(sfx, whoosh(0.4, False), 5.5, 0.5)
place(sfx, click(), F3)                                                 # Window 2 chip
place(sfx, whoosh(0.5, False), 6.5, 0.5)
place(sfx, whoosh(0.5, True), MET - 0.5, 0.9)
for at in (7.625, 7.75, 8.0): place(sfx, key(), at, 0.8)
place(sfx, click(), 8.25, 0.8)
place(sfx, whoosh(0.5, True), END - 0.5, 0.7)
place(sfx, click(), 9.5, 1.2)                                           # Add to Chrome

mix = lp(music, 12000) + kicks * 0.9 + sfx
mix[-int(SR * 0.4):] *= np.linspace(1, 0, int(SR * 0.4)) ** 2
st = np.stack([mix, mix], 1)
# tiny stereo width on the music only
st[:, 0] += np.roll(music, 240) * 0.08; st[:, 1] -= np.roll(music, 240) * 0.08
meter = pyln.Meter(SR); L = meter.integrated_loudness(st)
st = pyln.normalize.loudness(st, L, -14.0)
peak = np.abs(st).max()
if peak > 0.89: st = np.tanh(st / 0.89 * 1.0) * 0.89   # soft limit to ~-1 dBTP
L2 = meter.integrated_loudness(st); st = pyln.normalize.loudness(st, L2, -14.0)
print('LUFS', round(meter.integrated_loudness(st), 2), 'peak dBFS', round(20 * np.log10(np.abs(st).max()), 2))
wavfile.write('audio/score.wav', SR, (np.clip(st, -1, 1) * 32767).astype(np.int16))

# ---------------- measure the beat grid from the kick stem (onset detection), not from the plan
hop = 120; e = np.array([np.sum(kicks[i:i + hop] ** 2) for i in range(0, N - hop, hop)])
le = np.log10(e + 1e-9); d = np.diff(le, prepend=-9); thr = 2.0
onsets = []
for i in range(len(d)):
    if d[i] > thr and (not onsets or i * hop / SR - onsets[-1] > 0.2): onsets.append(round(i * hop / SR, 3))
ibis = np.diff([o for o in onsets if o >= PROD - 0.01])
json.dump({'bpm_measured': round(60 / np.median(ibis), 2), 'onsets': onsets,
           'beat': round(float(np.median(ibis)), 4), 'phase': onsets[1] % float(np.median(ibis)),
           'beats': [round(onsets[1] % float(np.median(ibis)) + k * float(np.median(ibis)), 3) for k in range(int(DUR / float(np.median(ibis))))]}, open('beats.json', 'w'), indent=1)
print('measured bpm', round(60 / np.median(ibis), 2), 'onsets', len(onsets), onsets[:8])
