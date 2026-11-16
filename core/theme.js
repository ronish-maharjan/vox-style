// core/theme.js — ALL look values live here. Usage: const theme = getTheme('default', '9:16')
// Formats (sizes, safe areas, caption bands) live in core/constants.js — the single source
// of truth shared with validate/qa/backends. Only colors/fonts/weights are defined here.
import { FORMATS } from './constants.js';
export { FORMATS };

const base = {
  name: 'default',
  colors: {
    paper: '#F3EBDD', paperDark: '#E6DBC6', white: '#FFFDF8',
    ink: '#1B1A17', inkSoft: '#4A463E',
    accent1: '#E8452C',   // tomato: marks, stamps, red string
    accent2: '#1F5FBF',   // cobalt: charts, maps
    highlight: '#FFD84A', // marker yellow
    kraft: '#C9A878', tape: 'rgba(214,190,140,0.78)',
    shadow: 'rgba(40,25,10,0.28)',
  },
  fonts: {
    display: 'Anton, Impact, "Arial Narrow", sans-serif',
    text: 'Inter, "Helvetica Neue", Arial, sans-serif',
    typed: '"Special Elite", "Courier New", monospace',
    serif: '"Libre Baskerville", Georgia, serif',
  },
  line: { thin: 3, normal: 6, bold: 10 },
  shadow: { blur: 22, dx: 6, dy: 12 },
  edge: { tornAmp: 7, tornStep: 16, wobble: 3 },
  motion: { enter: 0.35, exit: 0.25 },
  spacing: { xs: 8, sm: 16, md: 32, lg: 56, xl: 96 },
  grain: { opacity: 0.07 },
  captions: { upper: true, strokeRatio: 0.2 },
};

const themes = { default: base };

function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] || {}, v) : v;
  }
  return out;
}
export const registerTheme = (name, overrides) => { themes[name] = merge(base, { ...overrides, name }); };

export function getTheme(name = 'default', aspect = '9:16') {
  const t = themes[name];
  if (!t) throw new Error(`Unknown theme "${name}". Known: ${Object.keys(themes).join(', ')}`);
  const f = FORMATS[aspect];
  if (!f) throw new Error(`Unknown aspect "${aspect}". Use one of: ${Object.keys(FORMATS).join(', ')}`);
  return { ...t, format: f };
}
