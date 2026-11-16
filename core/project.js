// core/project.js — wires script + words + assets + renderer. DOM-free: the backend injects I/O.
// Usage: const P = await loadProject({ readJSON, loadImage, createCanvas, resolvePath, props, aspect?, strict? })
import { getTheme } from './theme.js';
import { createAssets } from './assets.js';
import { buildTimeline } from './director.js';
import { createRenderer } from './renderer.js';

/** readJSON(name, { optional }) must return null for a missing optional file and throw on parse errors. */
export async function loadProject({ readJSON, loadImage, createCanvas, resolvePath, props, aspect, strict = false }) {
  const script = await readJSON('script.json');
  const wordsJson = await readJSON('words.json', { optional: true });
  const asp = aspect || script.meta?.aspect || '9:16';
  const theme = getTheme(script.meta?.theme || 'default', asp);
  const assets = createAssets({ loadImage, createCanvas, resolvePath });
  const missing = await assets.preload(script.assets || {});
  const timeline = buildTimeline(script, wordsJson, { props });
  const renderer = createRenderer({ script, timeline, theme, assets, props, createCanvas, strict });
  return { script, timeline, renderer, theme, assets, missing, aspect: asp, estimated: timeline.estimated };
}
