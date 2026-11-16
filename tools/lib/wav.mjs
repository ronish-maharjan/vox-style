// Minimal WAV helpers. Everything the pipeline touches is 44.1 kHz mono 16-bit before assembly.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

export const RATE = 44100;

export function toWav(src, dst) {
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-ar', String(RATE), '-ac', '1', '-c:a', 'pcm_s16le', dst], { encoding: 'utf8' });
  if (r.error || r.status !== 0) throw new Error(`ffmpeg failed on ${src}: ${r.error?.message || r.stderr}`);
}

export function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`${file}: not a WAV`);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4);
    let sz = b.readUInt32LE(p + 4);
    const s = p + 8;
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(s + 2), rate: b.readUInt32LE(s + 4), bits: b.readUInt16LE(s + 14) };
    if (id === 'data') { if (s + sz > b.length) sz = b.length - s; data = b.subarray(s, s + sz); break; }
    p = s + sz + (sz & 1);
  }
  if (!fmt || !data) throw new Error(`${file}: malformed WAV`);
  if (fmt.bits !== 16 || fmt.ch !== 1) throw new Error(`${file}: expected 16-bit mono (got ${fmt.bits}-bit ${fmt.ch}ch)`);
  return { ...fmt, data, seconds: data.length / 2 / fmt.rate };
}

export const silence = (sec) => Buffer.alloc(Math.round(sec * RATE) * 2);

export function writeMono16(file, buffers) {
  const data = Buffer.concat(buffers);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}
