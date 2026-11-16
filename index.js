// index.js — public programmatic API for vox-studio.
// Usage:
//   import { renderProject } from 'vox-studio';
//   const { mp4, report, qa } = await renderProject({ project: 'demo', draft: true });
// Or load a project for inspection / custom tooling:
//   import { loadProject } from 'vox-studio';
//   const proj = await loadProject({ project: 'demo' });   // node backend, strict
//   const { canvas, draw } = proj.frame(); await draw(1.5); proj.be.png(canvas) -> Buffer
//
// Layering: lib/ (shared: registry, fonts) -> core/ (engine, DOM-free) -> backends/
// (node/browser I/O) -> tools/ (CLI). tools/ imports from lib/, core/ and backends/;
// core/ and backends/ never import from tools/.

export * from './core/constants.js';
export { getTheme, registerTheme, FORMATS } from './core/theme.js';
export { buildTimeline, shotAt, resolveTime, findWord } from './core/director.js';
export { createRenderer } from './core/renderer.js';
export { loadProject } from './core/project.js';
export { assertPropShape, checkType, parseType } from './core/protocol.js';
export { estimateWords, norm, tokenize, matchKey, mapTokens } from './core/words.js';
export { buildChunks, activeChunk } from './core/captions.js';

// Node-only surface (skipped transparently in browsers via dynamic import failures are NOT
// acceptable for static exports, so re-export through a guarded namespace).
import * as nodeApi from './backends/node.js';
export const node = nodeApi;

import path from 'node:path';
import fs from 'node:fs';
import { ROOT } from './lib/registry.mjs';

/**
 * One-call render: validate -> (optional) audio -> capture -> qa report.
 * Options:
 *   project   project name under projects/ (required)
 *   draft     15fps draft render (default true)
 *   aspect    override script aspect ('9:16' | '16:9' | '1:1' | '4:5')
 *   workers   render worker processes
 *   audio     path to a narration file; default: projects/<p>/audio/narration.wav|mp3 if present
 *   qa        also run the QA analyzer (default true); adds `report` + `qa` to the result
 *   validate  run validation first and throw on errors (default true)
 * Returns { mp4: absolute path, validation, qa } (qa fields null when disabled/failed)
 */
export async function renderProject(opts = {}) {
  const { project, draft = true, aspect = null, workers, audio, qa: wantQa = true, validate: wantValidate = true } = opts;
  if (!project) throw new Error('renderProject: "project" is required');
  if (!fs.existsSync(path.join(ROOT, 'projects', project, 'script.json'))) {
    throw new Error(`renderProject: projects/${project}/script.json not found`);
  }

  let validation = null;
  if (wantValidate) {
    const { validateProject } = await import('./tools/validate.mjs');
    validation = await validateProject({ project, aspect, dry: true, draft, root: ROOT });
    if (validation.errors.length || validation.missingProps.length) {
      const err = new Error(`renderProject: script invalid\n  ${[...validation.errors, ...validation.missingProps.map((m) => `missing prop: ${m.name}`)].join('\n  ')}`);
      err.validation = validation;
      throw err;
    }
  }

  const dir = path.join(ROOT, 'projects', project);
  let audioPath = audio ?? null;
  if (!audioPath) {
    for (const f of ['narration.wav', 'narration.mp3', 'narration.m4a']) {
      const p = path.join(dir, 'audio', f);
      if (fs.existsSync(p)) { audioPath = p; break; }
    }
  }

  const out = path.join(dir, draft ? 'out.draft.mp4' : 'out.mp4');
  const args = [path.join(ROOT, 'tools/capture.mjs'), project,
    ...(aspect ? ['--aspect', aspect] : []),
    ...(draft ? ['--draft'] : []),
    ...(workers ? ['--workers', String(workers)] : []),
    ...(audioPath ? ['--audio', audioPath] : []),
    '--out', out];
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, args, { stdio: 'pipe', encoding: 'utf8', cwd: ROOT });
  if (r.status !== 0) throw new Error(`renderProject: capture failed\n${(r.stderr || r.stdout || '').slice(-2000)}`);
  if (!fs.existsSync(out)) throw new Error('renderProject: capture reported success but wrote no file');

  let qa = null;
  if (wantQa) {
    try {
      const { analyzeProject } = await import('./tools/analyze.mjs');
      qa = await analyzeProject({ project, video: out, root: ROOT });
    } catch { /* QA is best-effort in the API */ }
  }

  return { mp4: out, validation, qa };
}
