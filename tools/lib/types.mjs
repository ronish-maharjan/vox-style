// tools/lib/types.mjs — parse + check the prop type grammar (meta.slots / meta.options).
// Usage: const s = normSpec('enum:a|b?'); checkValue(s, 'a') -> null | "error text"
// The 'length' check delegates to core/protocol.js so the validator and the runtime
// can never disagree about the grammar (M6 fix: '50pxX' is rejected, {portrait,landscape} accepted).

import { checkType } from '../../core/protocol.js';

const BASES = new Set(['string', 'number', 'boolean', 'asset', 'color', 'length', 'array', 'object', 'any']);

/** Accepts 'string?' or { type, default, doc }. Returns a normalised spec. */
export function normSpec(spec) {
  let raw = spec, def, doc;
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    raw = spec.type;
    def = spec.default ?? spec.def;
    doc = spec.doc ?? spec.desc ?? spec.description;
  }
  let t = typeof raw === 'string' ? raw.trim() : 'any';
  const out = { type: t, optional: false, default: def, doc, base: 'unknown' };
  if (t.endsWith('?')) { out.optional = true; t = t.slice(0, -1); }
  if (t.startsWith('enum:')) {
    out.base = 'enum';
    out.values = t.slice(5).split('|').map((s) => s.trim()).filter(Boolean);
  } else if (t.startsWith('range:')) {
    const m = /^range:(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/.exec(t);
    if (m) { out.base = 'range'; out.min = +m[1]; out.max = +m[2]; }
  } else if (BASES.has(t)) out.base = t;
  return out;
}

export const isRequired = (s) => !s.optional && s.default === undefined;

const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const nonEmptyStr = (v) => typeof v === 'string' && v.trim() !== '';

/** null when OK (or when the value is absent), otherwise a short message. */
export function checkValue(s, v) {
  if (v === undefined || v === null) return null;
  switch (s.base) {
    case 'string': return typeof v === 'string' ? null : `expected a string, got ${kind(v)}`;
    case 'number': return typeof v === 'number' && Number.isFinite(v) ? null : `expected a number, got ${kind(v)}`;
    case 'boolean': return typeof v === 'boolean' ? null : `expected true/false, got ${kind(v)}`;
    case 'asset': return nonEmptyStr(v) ? null : `expected an asset path (string), got ${kind(v)}`;
    case 'color': return nonEmptyStr(v) ? null : `expected a colour string, got ${kind(v)}`;
    case 'length': {
      const bad = checkType({ kind: 'length', optional: false }, v);
      return bad === null
        ? null
        : `expected a number, "50%" or "50" string, or {portrait,landscape}, got ${kind(v)}${typeof v === 'string' ? ` (${JSON.stringify(v)})` : ''}`;
    }
    case 'array': return Array.isArray(v) ? null : `expected an array, got ${kind(v)}`;
    case 'object': return kind(v) === 'object' ? null : `expected an object, got ${kind(v)}`;
    case 'enum': return s.values.includes(v) ? null : `expected one of ${s.values.join(' | ')}, got ${JSON.stringify(v)}`;
    case 'range':
      return typeof v === 'number' && v >= s.min && v <= s.max ? null : `expected a number from ${s.min} to ${s.max}, got ${JSON.stringify(v)}`;
    default: return null;
  }
}
