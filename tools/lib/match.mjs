// Script ↔ Whisper word matching. Pure functions, no I/O.
// Usage: const { tokens, inserted } = alignTokens(['In','1997'], whisperWords, { lo: 0, hi: duration });
// Both sides are expanded to spoken words first ("1997" → nineteen ninety seven), then globally aligned.

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORD = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function cardinal(n) {
  if (n < 20) return [ONES[n]];
  if (n < 100) return n % 10 ? [TENS[Math.floor(n / 10)], ONES[n % 10]] : [TENS[n / 10]];
  if (n < 1000) { const r = n % 100; return [ONES[Math.floor(n / 100)], 'hundred', ...(r ? cardinal(r) : [])]; }
  for (const [v, name] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) {
    if (n >= v) { const r = n % v; return [...cardinal(Math.floor(n / v)), name, ...(r ? cardinal(r) : [])]; }
  }
  return String(n).split('').map((d) => ONES[+d]);
}

export function year(n) {
  if (n >= 2000 && n <= 2009) return n === 2000 ? ['two', 'thousand'] : ['two', 'thousand', ...cardinal(n - 2000)];
  const hi = Math.floor(n / 100), lo = n % 100;
  if (lo === 0) return [...cardinal(hi), 'hundred'];
  if (lo < 10) return [...cardinal(hi), 'oh', ONES[lo]];
  return [...cardinal(hi), ...cardinal(lo)];
}

function ordinal(n) {
  const w = cardinal(n), last = w[w.length - 1];
  w[w.length - 1] = ORD[last] ?? (last.endsWith('y') ? last.slice(0, -1) + 'ieth' : last + 'th');
  return w;
}

/** One whitespace token → array of normalized spoken words. */
export function spokenWords(token) {
  const out = [];
  const t = String(token ?? '').toLowerCase().replace(/[’‘`]/g, "'");
  for (let p of t.split(/[-–—/]+/)) {
    const money = /^[^a-z0-9]*\$/.test(p);
    p = p.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9%]+$/, '');
    const pct = p.endsWith('%');
    if (pct) p = p.slice(0, -1);
    if (!p) continue;
    let m;
    if ((m = /^(\d+)(st|nd|rd|th)$/.exec(p))) out.push(...ordinal(+m[1]));
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$|^\d+(\.\d+)?$/.test(p)) {
      const [ip, fp] = p.replace(/,/g, '').split('.');
      const n = +ip;
      const yearLike = !p.includes(',') && !fp && ip.length === 4 && n >= 1100 && n <= 2099;
      out.push(...(yearLike ? year(n) : cardinal(n)));
      if (fp) out.push('point', ...fp.split('').map((d) => ONES[+d]));
    } else {
      const w = p.replace(/'/g, '').replace(/[^a-z0-9]/g, '');
      if (w) out.push(w);
    }
    if (pct) out.push('percent');
    if (money) out.push('dollars');
  }
  return out;
}

export function syllables(word) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const s = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = s.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

/** Rough natural reading time (same 0.17 s/syllable the director uses without audio). */
export function estimateSeconds(text) {
  const syl = String(text).split(/\s+/).flatMap(spokenWords).reduce((a, w) => a + syllables(w), 0);
  return Math.max(0.4, syl * 0.17);
}

function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
export function sim(a, b) {
  if (a === b) return 1;
  if (Math.min(a.length, b.length) <= 2) return 0;
  return 1 - lev(a, b) / Math.max(a.length, b.length);
}

const GAP = -1, MINSIM = 0.6;
const pair = (s) => (s === 1 ? 2 : s >= MINSIM ? 0.5 + (s - MINSIM) * 2 : -1.2);

function dp(S, H) {
  const n = S.length, m = H.length, W = m + 1;
  const sc = new Float32Array((n + 1) * W), tr = new Uint8Array((n + 1) * W); // 0 diag, 1 skip script, 2 skip heard
  for (let i = 1; i <= n; i++) { sc[i * W] = i * GAP; tr[i * W] = 1; }
  for (let j = 1; j <= m; j++) { sc[j] = j * GAP; tr[j] = 2; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const d = sc[(i - 1) * W + j - 1] + pair(sim(S[i - 1].w, H[j - 1].w));
      const u = sc[(i - 1) * W + j] + GAP, l = sc[i * W + j - 1] + GAP;
      let best = d, t = 0;
      if (u > best) { best = u; t = 1; }
      if (l > best) { best = l; t = 2; }
      sc[i * W + j] = best; tr[i * W + j] = t;
    }
  }
  const map = new Array(n).fill(-1), sims = new Array(n).fill(0);
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const t = tr[i * W + j];
    if (i > 0 && j > 0 && t === 0) {
      const s = sim(S[i - 1].w, H[j - 1].w);
      if (s >= MINSIM) { map[i - 1] = j - 1; sims[i - 1] = s; }
      i--; j--;
    } else if (i > 0 && t === 1) i--;
    else j--;
  }
  return { map, sims };
}

/**
 * rawTokens: script whitespace tokens. heardWords: [{w,start,end,p}] from Whisper.
 * Returns { tokens:[{raw,start,end,conf,hit,units,guessed}], inserted:[{w,start,end}] }.
 */
export function alignTokens(rawTokens, heardWords, { lo = 0, hi = null } = {}) {
  const S = [];
  rawTokens.forEach((raw, ti) => { for (const w of spokenWords(raw)) S.push({ w, ti }); });
  const H = [];
  for (const hw of heardWords) {
    const sp = spokenWords(hw.w);
    const d = (hw.end - hw.start) / Math.max(1, sp.length);
    sp.forEach((w, i) => H.push({ w, start: hw.start + i * d, end: hw.start + (i + 1) * d, p: hw.p ?? 1 }));
  }
  const { map, sims } = dp(S, H);
  const used = new Set();
  const tokens = rawTokens.map((raw) => ({ raw, units: 0, hit: 0, start: null, end: null, confSum: 0, guessed: false }));
  S.forEach((u, i) => {
    const t = tokens[u.ti];
    t.units++;
    const j = map[i];
    if (j < 0) return;
    const h = H[j];
    t.hit++; used.add(j);
    t.start = t.start == null ? h.start : Math.min(t.start, h.start);
    t.end = Math.max(t.end ?? 0, h.end);
    t.confSum += sims[i] * (0.5 + 0.5 * clamp01(h.p));
  });

  // interpolate runs of tokens that were not heard
  const N = tokens.length;
  let i = 0;
  while (i < N) {
    if (tokens[i].start != null) { i++; continue; }
    let j = i;
    while (j < N && tokens[j].start == null) j++;
    const n = j - i;
    const prevEnd = i > 0 ? tokens[i - 1].end : null;
    const nextStart = j < N ? tokens[j].start : null;
    let a, b;
    if (prevEnd != null && nextStart != null) { a = prevEnd; b = nextStart; }
    else if (nextStart != null) { b = nextStart; a = Math.max(lo, b - 0.3 * n); }
    else if (prevEnd != null) { a = prevEnd; b = hi != null ? Math.min(hi, a + 0.3 * n) : a + 0.3 * n; }
    else { a = lo; b = hi ?? lo + 0.3 * n; }
    if (b < a) b = a;
    const wts = tokens.slice(i, j).map((t) => Math.max(1, t.raw.length));
    const tot = wts.reduce((x, y) => x + y, 0);
    let cur = a;
    for (let k = i; k < j; k++) {
      tokens[k].start = cur; cur += ((b - a) * wts[k - i]) / tot; tokens[k].end = cur; tokens[k].guessed = true;
    }
    i = j;
  }
  let prev = lo;
  for (const t of tokens) {
    t.start = Math.max(t.start, prev);
    t.end = Math.max(t.end, t.start + 0.03);
    prev = t.start;
  }
  return {
    tokens: tokens.map((t) => ({
      raw: t.raw, start: t.start, end: t.end, hit: t.hit, units: t.units, guessed: t.guessed,
      conf: t.units ? t.confSum / t.units : 1,
    })),
    inserted: H.filter((_, j) => !used.has(j)).map(({ w, start, end }) => ({ w, start, end })),
  };
}
