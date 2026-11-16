// Cue parsing shared by align (gate) and sfx (timing). Grammar: "word:kong", "word:the#2", "word:kong+0.2s".
// cueKey delegates to core/words.js matchKey so the align gate and the director can never
// disagree about whether a cue matches a spoken word (#1 fix: "dont" vs "don't").
import { matchKey } from '../../core/words.js';
export const cueKey = (s) => matchKey(String(s));
const CUE = /^word:([^#+\s]+?)(?:#(\d+))?(?:\s*[+-]\d*\.?\d+s)?$/;

export function parseCue(str) {
  const m = CUE.exec(String(str).trim());
  return m ? { word: m[1], nth: m[2] ? +m[2] : 1 } : null;
}

function walk(v, fn, p = '') {
  if (typeof v === 'string') fn(v, p);
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, fn, `${p}[${i}]`));
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], fn, p ? `${p}.${k}` : k);
}

/** Every word: cue in the script with the line it belongs to. */
export function cueRefs(script) {
  const out = [];
  (script.shots || []).forEach((shot, si) => {
    const line = shot.line ?? shot.lineId;
    walk(shot, (s, where) => {
      const c = parseCue(s);
      if (c) out.push({ shot: shot.id ?? `#${si + 1}`, line, ...c, raw: s, where });
    });
  });
  return out;
}

/** Index of the nth token whose normalized form equals the cue word, or -1. */
export function resolveCueToken(tokens, { word, nth = 1 }) {
  const key = cueKey(word);
  let n = 0;
  for (let i = 0; i < tokens.length; i++) if (cueKey(tokens[i]) === key && ++n === nth) return i;
  return -1;
}
