#!/usr/bin/env python3
"""Synthesises paper-craft SFX (numpy/scipy, deterministic) and lays them on a timeline (mono wav).
Usage: sfx.py --events events.json --duration 38.2 --out sfx.wav     events: [{t, name, gain}]"""
import argparse, json, sys, zlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100


def rng_for(name): return np.random.default_rng(zlib.crc32(name.encode()))
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def tt(d): return np.arange(int(d * SR)) / SR
def norm(x, peak=0.8):
    m = np.abs(x).max()
    return x * (peak / m) if m > 0 else x


def sweep_lp(x, f0, f1, passes=2):
    n = len(x)
    a = 1 - np.exp(-2 * np.pi * np.geomspace(f0, f1, n) / SR)
    y = x
    for _ in range(passes):
        out = np.empty(n); s = 0.0
        for i in range(n):
            s += a[i] * (y[i] - s); out[i] = s
        y = out
    return y


def whoosh(r, d=0.6, lo=250, hi=5200, g=1.0):
    n = int(d * SR)
    env = np.sin(np.pi * np.linspace(0, 1, n) ** 0.8) ** 2
    return norm(sweep_lp(r.standard_normal(n), lo, hi) * env) * g

def slide(r): return whoosh(r, 0.4, 400, 2400, 0.7)

def paper(r):
    n = int(0.3 * SR)
    x = hp(r.standard_normal(n), 1800)
    env = np.zeros(n)
    for pos in sorted(r.integers(0, int(n * 0.55), 7)):
        L = n - pos
        env[pos:] = np.maximum(env[pos:], np.exp(-np.arange(L) / (0.014 * SR)) * r.uniform(0.35, 1))
    return norm(x * env, 0.7)

def swipe(r):
    n = int(0.42 * SR)
    y = hp(sweep_lp(r.standard_normal(n), 1200, 7500), 900)
    return norm(y * np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5, 0.7)

def thud(r):
    t = tt(0.5)
    ph = 2 * np.pi * np.cumsum(45 + 75 * np.exp(-t / 0.05)) / SR
    click = lp(r.standard_normal(len(t)), 900) * np.exp(-t / 0.012) * 0.7
    return norm(np.sin(ph) * np.exp(-t / 0.13) + click, 0.9)

def tick(r):
    t = tt(0.08)
    return norm(np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.007) + 0.3 * hp(r.standard_normal(len(t)), 3000) * np.exp(-t / 0.004), 0.6)

def pop(r):
    t = tt(0.2)
    ph = 2 * np.pi * np.cumsum(300 + 700 * (1 - np.exp(-t / 0.02))) / SR
    return norm(np.sin(ph) * np.exp(-t / 0.05) * (1 - np.exp(-t / 0.002)), 0.7)

def scribble(r):
    t = tt(0.55)
    y = hp(sweep_lp(r.standard_normal(len(t)), 2500, 6000), 1200)
    return norm(y * np.abs(np.sin(2 * np.pi * 6.5 * t)) ** 0.6 * np.sin(np.pi * t / 0.55), 0.6)


SOUNDS = dict(whoosh=whoosh, slide=slide, paper=paper, swipe=swipe, thud=thud, tick=tick, pop=pop, scribble=scribble)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--events', required=True)
    ap.add_argument('--duration', type=float, required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    N = int(a.duration * SR)
    out = np.zeros(N)
    cache = {}
    events = json.load(open(a.events))
    for e in events:
        name = e['name']
        if name not in SOUNDS:
            print(f"  ⚠ unknown sfx '{name}' → using 'tick'. Known: {', '.join(SOUNDS)}", file=sys.stderr)
            name = 'tick'
        if name not in cache:
            cache[name] = SOUNDS[name](rng_for(name))
        s = cache[name] * float(e.get('gain', 1))
        i0 = int(max(0.0, e['t']) * SR)
        if i0 >= N: continue
        end = min(N, i0 + len(s))
        out[i0:end] += s[:end - i0]
    out = np.tanh(out * 1.1)
    wavfile.write(a.out, SR, (np.clip(out, -1, 1) * 32767).astype(np.int16))
    print(f"  sfx: {len(events)} events → {a.out}")


if __name__ == '__main__':
    main()
