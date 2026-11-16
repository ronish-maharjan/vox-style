// core/protocol.js — prop shape + type grammar. Usage: assertPropShape(prop, 'solidBg'); checkType('range:0..1', 0.5) -> null | 'message'
import { EASES } from './easing.js';

const KINDS = ['string', 'number', 'boolean', 'asset', 'color', 'length', 'array', 'object', 'any'];

/** 'string' | 'number?' | 'enum:a|b' | 'range:0..1' | 'length' (px, "50%", {portrait,landscape}) | 'asset' | 'color' ... */
export function parseType(str) {
  let s = String(str).trim();
  const optional = s.endsWith('?');
  if (optional) s = s.slice(0, -1);
  const i = s.indexOf(':'), kind = i < 0 ? s : s.slice(0, i), arg = i < 0 ? '' : s.slice(i + 1);
  if (kind === 'enum') {
    const values = arg.split('|').filter(Boolean);
    if (!values.length) throw new Error(`bad enum type "${str}"`);
    return { kind, optional, values };
  }
  if (kind === 'range') {
    const m = /^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/.exec(arg);
    if (!m) throw new Error(`bad range type "${str}" (use range:0..1)`);
    return { kind, optional, min: +m[1], max: +m[2] };
  }
  if (!KINDS.includes(kind)) throw new Error(`unknown type "${str}". Kinds: ${KINDS.join(', ')}, enum:a|b, range:0..1`);
  return { kind, optional };
}

const isLen = (v) =>
  (typeof v === 'number' && Number.isFinite(v)) ||
  (typeof v === 'string' && /^-?\d+(\.\d+)?%?$/.test(v.trim())) ||
  (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 &&
    Object.entries(v).every(([k, x]) => ['portrait', 'landscape', 'default'].includes(k) && isLen(x)));

/** null when ok, otherwise a short message ("must be ...") */
export function checkType(type, v) {
  const t = typeof type === 'string' ? parseType(type) : type;
  if (v === undefined || v === null) return t.optional ? null : 'is required';
  switch (t.kind) {
    case 'string': case 'asset': case 'color': return typeof v === 'string' ? null : `must be a string (${t.kind})`;
    case 'number': return Number.isFinite(v) ? null : 'must be a number';
    case 'boolean': return typeof v === 'boolean' ? null : 'must be true or false';
    case 'length': return isLen(v) ? null : 'must be px, "NN%", or {portrait,landscape}';
    case 'enum': return t.values.includes(v) ? null : `must be one of ${t.values.join('|')}`;
    case 'range': return Number.isFinite(v) && v >= t.min && v <= t.max ? null : `must be a number in ${t.min}..${t.max}`;
    case 'array': return Array.isArray(v) ? null : 'must be an array';
    case 'object': return v && typeof v === 'object' && !Array.isArray(v) ? null : 'must be an object';
    default: return null;
  }
}

export function assertPropShape(prop, where = 'prop') {
  const bad = [], m = prop && prop.meta;
  if (!m) bad.push('missing meta');
  else {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(m.name || '')) bad.push('meta.name must be camelCase letters/digits');
    if (!m.use || typeof m.use !== 'string') bad.push('meta.use (when to choose it) is required');
    if (!m.avoid || typeof m.avoid !== 'string') bad.push('meta.avoid (the "do not" line) is required');
    if (!(m.defaultDuration > 0)) bad.push('meta.defaultDuration must be a number > 0');
    if (!m.example || typeof m.example !== 'object') bad.push('meta.example must be an object');
    if (m.space && !['world', 'screen'].includes(m.space)) bad.push('meta.space must be world|screen');
    if (m.depth !== undefined && !(m.depth >= 0 && m.depth <= 1)) bad.push('meta.depth must be 0..1');
    if (m.enterEase && !EASES.includes(m.enterEase)) bad.push(`meta.enterEase must be one of ${EASES.join(', ')}`);
    // P0.2: optional on-draw default size {w,h} in px (9:16), used by the bounds registry
    // so "target" can lock onto a placed layer that has no explicit w/h in the script.
    if (m.defaultSize !== undefined && !(
      m.defaultSize && typeof m.defaultSize === 'object' &&
      Number.isFinite(m.defaultSize.w) && m.defaultSize.w > 0 &&
      Number.isFinite(m.defaultSize.h) && m.defaultSize.h > 0
    )) bad.push('meta.defaultSize must be { w, h } in px (> 0)');
    for (const group of ['slots', 'options']) {
      if (!m[group] || typeof m[group] !== 'object') { bad.push(`meta.${group} must be an object`); continue; }
      for (const [k, ty] of Object.entries(m[group])) { try { parseType(ty); } catch (e) { bad.push(`meta.${group}.${k}: ${e.message}`); } }
    }
    if (m.slots && m.options) for (const k of Object.keys(m.slots)) if (k in m.options) bad.push(`"${k}" is both a slot and an option`);
  }
  if (!prop || typeof prop.draw !== 'function') bad.push('draw(ctx, o, env) must be a function');
  if (bad.length) throw new Error(`${where}: ${bad.join('; ')}`);
  return true;
}
