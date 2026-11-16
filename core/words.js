// core/words.js — text -> words. Usage: norm('1997,'); estimateWords(lines); mapTokens(dispNorms, spokenNorms)
export const norm = (w) =>
  String(w ?? '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}']+/gu, '').replace(/^'+|'+$/g, '');
export const tokenize = (s) => String(s ?? '').split(/\s+/).filter(Boolean);
/** Cue-word matching key: norm with apostrophes removed, so the cue "dont" matches the spoken "don't" (#1 fix). */
export const matchKey = (w) => norm(w).replace(/'/g, '');

export function countSyllables(word) {
  const w = norm(word);
  if (!w) return 0;
  if (/^\d+$/.test(w)) return Math.max(1, Math.ceil(w.length * 1.5));
  const g = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, g ? g.length : 0);
}

/** Fallback timing when there is no audio yet. Same shape as words.json. */
export function estimateWords(lines) {
  let cur = 0.4;
  const out = [];
  for (const L of lines) {
    const words = [], start = cur;
    for (const tok of tokenize(L.say ?? L.text)) {
      if (!norm(tok)) continue;
      const d = countSyllables(tok) * 0.17 + 0.06;
      words.push({ w: tok, start: cur, end: cur + d });
      cur += d + (/[.!?]["')\]]*$/.test(tok) ? 0.38 : /[,;:—–]["')\]]*$/.test(tok) ? 0.16 : 0.03);
    }
    const end = words.length ? words[words.length - 1].end : start + 0.5;
    out.push({ id: L.id, start, end, words });
    cur = end + 0.3;
  }
  return { estimated: true, lines: out };
}

/**
 * Map display tokens (caption spelling) onto spoken tokens (say spelling).
 * Both are arrays of normalized strings ('' = silent punctuation). Returns [[lo,hi],...] spoken-word index ranges.
 * "1997" -> [1,2] when spoken as "nineteen ninety-seven".
 */
export function mapTokens(disp, spoken) {
  const nD = disp.length, nS = spoken.length, map = new Array(nD).fill(null);
  const clampIdx = (x) => Math.max(0, Math.min(nS - 1, x));
  let s = 0;
  for (let i = 0; i < nD; i++) {                       // 1) greedy in-order anchors (window of 8)
    if (!disp[i]) continue;
    for (let m = s; m < Math.min(nS, s + 8); m++) if (spoken[m] === disp[i]) { map[i] = [m, m]; s = m + 1; break; }
  }
  let i = 0;
  while (i < nD) {                                     // 2) fill gaps between anchors
    if (map[i]) { i++; continue; }
    let j = i;
    while (j < nD && !map[j]) j++;
    const a = i ? map[i - 1][1] + 1 : 0, b = j < nD ? map[j][0] - 1 : nS - 1, len = b - a + 1;
    const real = [];
    for (let k = i; k < j; k++) if (disp[k]) real.push(k);
    real.forEach((k, n) => {
      if (len > 0) {
        const lo = a + Math.floor((n * len) / real.length);
        map[k] = [lo, Math.min(b, Math.max(lo, a + Math.floor(((n + 1) * len) / real.length) - 1))];
      } else { const at = clampIdx(i ? map[i - 1][1] : j < nD ? map[j][0] : 0); map[k] = [at, at]; }
    });
    for (let k = i; k < j; k++) if (!map[k]) map[k] = k ? [map[k - 1][1], map[k - 1][1]] : [0, 0];   // silent tokens inherit
    i = j;
  }
  return map;
}
