#!/usr/bin/env python3
"""Voice + SFX + music bed with voice-driven ducking -> stereo WAV.

Loudness (-14 LUFS) is applied afterwards by tools/mix.mjs
using ffmpeg loudnorm (two-pass).

Usage:
    mix.py --voice v.wav --sfx s.wav [--music m.wav] \
        --duration 38 --out mix.wav
"""

import argparse

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100

# Am - F - C - G
CHORDS = [
    [57, 60, 64],
    [53, 57, 60],
    [48, 52, 55],
    [55, 59, 62],
]


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def read_audio(path):
    """Read a WAV file and convert it to float64 stereo."""
    sr, x = wavfile.read(path)

    if sr != SR:
        raise SystemExit(
            f'{path}: expected {SR} Hz, got {sr}'
        )

    if np.issubdtype(x.dtype, np.integer):
        info = np.iinfo(x.dtype)

        if info.min == 0:
            midpoint = (info.max + 1) / 2
            x = (x.astype(np.float64) - midpoint) / midpoint
        else:
            x = x.astype(np.float64) / max(
                abs(info.min), info.max
            )
    elif np.issubdtype(x.dtype, np.floating):
        x = x.astype(np.float64)
    else:
        raise SystemExit(
            f'{path}: unsupported WAV dtype {x.dtype}'
        )

    if x.ndim == 1:
        x = np.column_stack((x, x))
    elif x.ndim == 2:
        if x.shape[1] == 1:
            x = np.column_stack((x[:, 0], x[:, 0]))
        else:
            x = x[:, :2]
    else:
        raise SystemExit(f'{path}: unsupported audio shape {x.shape}')

    return x


def load(path, n):
    """Load audio, pad or truncate to n stereo samples."""
    y = np.zeros((n, 2), dtype=np.float64)

    if not path:
        return y, 0

    x = read_audio(path)
    m = min(n, len(x))
    y[:m] = x[:m]

    return y, len(x)


def active_rms(x, thr_ratio=0.02):
    """Estimate RMS using samples above a relative noise threshold."""
    m = np.abs(x).max()

    if m == 0:
        return 1.0

    v = x[np.abs(x) > m * thr_ratio]

    if len(v) == 0:
        return 1.0

    return float(np.sqrt(np.mean(v ** 2)))


def bed(n, seed):
    """Generate a simple ambient music bed."""
    rng = np.random.default_rng(seed)
    out = np.zeros((n, 2))

    seg, fade = 6.0, 1.5
    k = 0

    while k * seg < n / SR + 0.1:
        notes = CHORDS[k % 4]

        start = int(k * seg * SR)
        end = min(n, start + int((seg + fade) * SR))

        if end <= start:
            break

        t = np.arange(end - start) / SR

        env = (
            np.minimum(1, t / fade)
            * np.minimum(1, (seg + fade - t) / fade)
        )

        for side, det in ((0, 0.997), (1, 1.003)):
            sig = np.zeros(len(t))

            for note in notes:
                f = mtof(note) * det

                sig += (
                    np.sin(2 * np.pi * f * t)
                    + 0.4 * np.sin(2 * np.pi * 2 * f * t)
                    + 0.15 * np.sin(2 * np.pi * 3 * f * t)
                )

            sig += (
                1.2
                * np.sin(2 * np.pi * mtof(notes[0] - 12) * t)
            )

            out[start:end, side] += sig * env * 0.12

        k += 1

    # Soft rhythmic notes
    step = 0.375
    pat = [0, 1, 2, 1]

    for i in range(int(n / SR / step)):
        ch = CHORDS[int(i * step // seg) % 4]
        f = mtof(ch[pat[i % 4]] + 12)

        t = np.arange(int(0.5 * SR)) / SR

        p = (
            np.sin(2 * np.pi * f * t)
            * np.exp(-t / 0.18)
            * 0.05
            * rng.uniform(0.7, 1.0)
        )

        i0 = int(i * step * SR)
        e = min(n, i0 + len(p))

        pan = 0.35 if i % 2 else 0.65

        out[i0:e, 0] += p[:e - i0] * (1 - pan) * 2
        out[i0:e, 1] += p[:e - i0] * pan * 2

    return sosfilt(
        butter(2, 2200, 'low', fs=SR, output='sos'),
        out,
        axis=0,
    )


def fit_music(x, n):
    """Loop music to fill the requested duration."""
    if len(x) == 0:
        return np.zeros((n, 2))

    reps = int(np.ceil(n / len(x)))

    return np.tile(x, (reps, 1))[:n]


def fades(x, fin=1.0, fout=2.0):
    """Apply fade-in and fade-out safely, including short clips."""
    n = len(x)
    g = np.ones(n)

    a = min(n, int(fin * SR))
    b = min(n, int(fout * SR))

    if a:
        g[:a] = np.linspace(0, 1, a)

    if b:
        g[n - b:] *= np.linspace(1, 0, b)

    return x * g[:, None]


def duck_curve(voice, n, depth_db, attack=0.08, release=0.5):
    """Create a smooth music attenuation curve driven by narration."""
    hop = 441  # 100 Hz control rate
    m = n // hop + 1

    # Stereo RMS prevents left/right phase cancellation.
    v = np.sqrt(np.mean(voice ** 2, axis=1))
    v = np.pad(v, (0, m * hop - n))

    env = np.sqrt(
        np.mean(v.reshape(m, hop) ** 2, axis=1)
    )

    active = env[env > 1e-4]

    ref = np.percentile(active, 90) if len(active) else 1.0

    tgt = np.clip(env / ref * 1.5, 0, 1)

    aa = 1 - np.exp(-1 / (attack * 100))
    ar = 1 - np.exp(-1 / (release * 100))

    g = np.zeros(m)
    s = 0.0

    for i in range(m):
        coeff = aa if tgt[i] > s else ar
        s += coeff * (tgt[i] - s)
        g[i] = s

    return np.interp(
        np.arange(n) / hop,
        np.arange(m),
        10 ** (-depth_db * g / 20),
    )


def main():
    ap = argparse.ArgumentParser()

    ap.add_argument('--voice')
    ap.add_argument('--sfx')
    ap.add_argument('--sfx-gain', type=float, default=0.5, dest='sfx_gain')
    ap.add_argument('--music')

    ap.add_argument('--duration', type=float, required=True)
    ap.add_argument('--out', required=True)

    ap.add_argument('--music-db', type=float, default=-17.0)
    ap.add_argument('--duck-db', type=float, default=7.0)

    ap.add_argument('--no-music', action='store_true')
    ap.add_argument('--seed', type=int, default=1997)

    a = ap.parse_args()

    if a.duration <= 0:
        ap.error('--duration must be greater than zero')

    n = int(round(a.duration * SR))

    # Load narration and SFX.
    voice, vlen = load(a.voice, n)
    sfx, _ = load(a.sfx, n)

    if vlen > n + SR // 10:
        print(
            f'  Warning: narration is '
            f'{vlen / SR - n / SR:.1f}s longer than the video '
            f'-- it will be cut'
        )

    # Normalize narration.
    voice *= 0.12 / active_rms(voice)

    # Prepare music.
    mus = np.zeros((n, 2))

    if not a.no_music:
        if a.music:
            x = read_audio(a.music)
            mus = fit_music(x, n)
        else:
            mus = bed(n, a.seed)

    # Apply music processing exactly once.
    if mus.any():
        mus = fades(mus)

        mus *= 0.12 / max(
            1e-9,
            float(np.sqrt(np.mean(mus ** 2))),
        )

        mus *= (
            10 ** (a.music_db / 20)
            * duck_curve(voice, n, a.duck_db)[:, None]
        )

    # Combine all audio layers.
    mix = voice + sfx * a.sfx_gain + mus

    # Safety peak limiter.
    peak = np.abs(mix).max()

    if peak > 0.98:
        mix *= 0.98 / peak

    # Export stereo PCM 16-bit WAV.
    wavfile.write(
        a.out,
        SR,
        (np.clip(mix, -1, 1) * 32767).astype(np.int16),
    )

    music_source = (
        'off' if a.no_music
        else 'file' if a.music
        else 'generated'
    )

    print(
        f'  mix: {a.duration:.1f}s, '
        f'music {music_source} -> {a.out}'
    )


if __name__ == '__main__':
    main()
