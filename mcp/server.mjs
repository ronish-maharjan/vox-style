#!/usr/bin/env node
// mcp/server.mjs — Model Context Protocol server for vox-studio (stdio transport).
// Lets any tool-calling AI (Claude, ChatGPT, …) drive the whole studio without a terminal:
// catalog, slots, validate, compile, video (draft/final), qa-report, frame, speak.
//
// Run:    npm run mcp                       (stdio; the agent client spawns and talks JSON-RPC)
// Config: { "mcpServers": { "vox-studio": { "command": "npm", "args": ["run", "mcp"] } } }
//
// Protocol: MCP 2024-11-05 over stdio (initialize / tools/list / tools/call / ping).
// No external dependencies; Node >= 20.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, discoverProps } from '../lib/registry.mjs';

// ── tool implementations ─────────────────────────────────────────────────────

async function toolCatalog() {
  const { props } = await discoverProps({ root: ROOT });
  const cats = new Map();
  for (const def of props.values()) {
    const m = def.def.meta;
    const c = m.category || 'misc';
    if (!cats.has(c)) cats.set(c, []);
    cats.get(c).push({
      name: m.name,
      use: m.use,
      avoid: m.avoid,
      slots: m.slots || {},
      options: m.options || {},
      defaultDuration: m.defaultDuration,
      space: m.space || 'world',
      depth: m.depth ?? 0.5,
      example: m.example,
      ...(m.defaultSize ? { defaultSize: m.defaultSize } : {}),
    });
  }
  const recipes = fs.existsSync(path.join(ROOT, 'recipes'))
    ? fs.readdirSync(path.join(ROOT, 'recipes')).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
        .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'recipes', f), 'utf8')); } catch { return null; } })
        .filter(Boolean).map(({ name, use, params }) => ({ name, use, params }))
    : [];
  return {
    formats: ['9:16', '16:9', '1:1', '4:5'],
    cameraMoves: ['push-in', 'pull-out', 'pan-left', 'pan-right', 'pan-up', 'pan-down', 'drift', 'tilt', 'shake', 'hold'],
    placements: ['center', 'upper', 'top', 'lower', 'bottom', 'stack'],
    recipes,
    propsByCategory: Object.fromEntries(cats),
  };
}

async function toolSlots({ prop }) {
  const { props } = await discoverProps({ root: ROOT });
  const def = props.get(prop)?.def;
  if (!def) return { error: `unknown prop "${prop}"`, known: [...props.keys()] };
  const m = def.meta;
  return { name: m.name, use: m.use, avoid: m.avoid, slots: m.slots, options: m.options, example: m.example, defaultDuration: m.defaultDuration };
}

const run = (file, args) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', file), ...args], { encoding: 'utf8', cwd: ROOT, maxBuffer: 1 << 27, timeout: 10 * 60_000 });
  return { status: r.status, stdout: String(r.stdout || ''), stderr: String(r.stderr || '') };
};

async function toolValidate({ project, aspect, draft = true }) {
  const r = run('validate.mjs', [project, '--json', ...(aspect ? ['--aspect', aspect] : []), ...(draft ? ['--draft'] : [])]);
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* fall through to text */ }
  return json ?? { error: 'validate failed to produce JSON', exit: r.status, output: (r.stdout + r.stderr).slice(0, 4000) };
}

async function toolCompile({ project, intent, dryRun = false }) {
  const dir = path.join(ROOT, 'projects', project);
  if (intent && typeof intent === 'object') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'intent.json'), JSON.stringify(intent, null, 2) + '\n');
  }
  if (!fs.existsSync(path.join(dir, 'intent.json'))) return { error: `projects/${project}/intent.json not found and no intent given` };
  const r = run('compile.mjs', [project, ...(dryRun ? ['--dry-run'] : [])]);
  return { exit: r.status, ...(r.status === 0 ? { script: dryRun ? undefined : path.join('projects', project, 'script.json'), output: r.stdout.slice(0, 2000) } : { errors: (r.stderr || r.stdout).slice(0, 4000) }) };
}

async function toolVideo({ project, draftOnly = false, fromIntent = false, aspect, voice, workers }) {
  const args = [project, ...(draftOnly ? ['--draft-only'] : []), ...(fromIntent ? ['--from-intent'] : []),
    ...(aspect ? ['--aspect', aspect] : []), ...(voice ? ['--voice', voice] : []), ...(workers ? ['--workers', String(workers)] : [])];
  const r = run('video.mjs', args);
  const statusPath = path.join(ROOT, 'projects', project, 'build', 'video.status.json');
  const status = fs.existsSync(statusPath) ? JSON.parse(fs.readFileSync(statusPath, 'utf8')) : null;
  return {
    exit: r.status,
    ok: r.status === 0,
    output: (r.stdout + r.stderr).split('\n').filter((l) => /^[✔✖⚠→]|^── /.test(l.trim())).slice(0, 40).join('\n'),
    status,
  };
}

async function toolQaReport({ project, full = false }) {
  const video = path.join(ROOT, 'projects', project, full ? 'out.mp4' : 'out.draft.mp4');
  if (!fs.existsSync(video)) return { error: `no render at ${path.relative(ROOT, video)} — run the video tool first` };
  const { analyzeProject } = await import('../tools/analyze.mjs');
  return analyzeProject({ project, video, root: ROOT });
}

async function toolFrame({ project, time, full = false, out }) {
  const video = path.join(ROOT, 'projects', project, full ? 'out.mp4' : 'out.draft.mp4');
  if (!fs.existsSync(video)) return { error: `no render at ${path.relative(ROOT, video)} — run the video tool first` };
  const dest = path.resolve(ROOT, out || path.join('projects', project, 'qa', `frame-${String(time).replace('.', '_')}s.png`));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const { findFfmpeg } = await import('../tools/lib/env.mjs');
  const ff = findFfmpeg();
  const r = spawnSync(ff, ['-y', '-v', 'error', '-ss', String(time), '-i', video, '-frames:v', '1', dest], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(dest)) return { error: 'ffmpeg frame grab failed: ' + r.stderr.slice(0, 500) };
  return { image: path.relative(ROOT, dest), absolute: dest };
}

async function toolSpeak({ project, voice, dryRun = false, force = false }) {
  const r = run('speak.mjs', [project, ...(voice ? ['--voice', voice] : []), ...(dryRun ? ['--dry-run'] : []), ...(force ? ['--force'] : [])]);
  return { exit: r.status, ok: r.status === 0, output: (r.stdout + r.stderr).slice(0, 2000) };
}

// ── MCP plumbing (stdio JSON-RPC, MCP 2024-11-05) ───────────────────────────

const TOOLS = [
  {
    name: 'vox_catalog',
    description: 'List every prop (with use/avoid/slots/options/example), recipe, format, camera move and placement the studio supports. Call this FIRST when planning a video.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: toolCatalog,
  },
  {
    name: 'vox_slots',
    description: 'Full slot/option reference for one prop (better than guessing from the catalog summary).',
    inputSchema: { type: 'object', properties: { prop: { type: 'string', description: 'prop name, e.g. bigNumber' } }, required: ['prop'], additionalProperties: false },
    run: toolSlots,
  },
  {
    name: 'vox_validate',
    description: 'Validate a project script. Returns errors/warnings/missingProps as JSON. THE authority on whether a script is correct.',
    inputSchema: { type: 'object', properties: { project: { type: 'string' }, aspect: { type: 'string', enum: ['9:16', '16:9', '1:1', '4:5'] }, draft: { type: 'boolean', default: true } }, required: ['project'], additionalProperties: false },
    run: toolValidate,
  },
  {
    name: 'vox_compile',
    description: 'Compile a simple intent file (lines + recipes + params) into a full script.json. Recipes are listed in vox_catalog. Cue words and spans are auto-picked.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string' },
        intent: { type: 'object', description: 'intent object; omitted = compile the existing intent.json' },
        dryRun: { type: 'boolean', default: false },
      },
      required: ['project'],
      additionalProperties: false,
    },
    run: toolCompile,
  },
  {
    name: 'vox_video',
    description: 'Render a project to MP4 (the whole pipeline: validate -> audio (TTS if available) -> draft -> QA -> final). draftOnly=true stops after the draft. Returns the stage status.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string' },
        draftOnly: { type: 'boolean', default: false },
        fromIntent: { type: 'boolean', description: 'compile intent.json first' },
        aspect: { type: 'string', enum: ['9:16', '16:9', '1:1', '4:5'] },
        voice: { type: 'string', description: 'TTS voice preset: narrator|news|warm|documentary' },
        workers: { type: 'number' },
      },
      required: ['project'],
      additionalProperties: false,
    },
    run: toolVideo,
  },
  {
    name: 'vox_qa_report',
    description: 'Machine-readable QA report of a rendered project: shot table, flags (LONG/EMPTY/COLLISION), suggestions, loudness.',
    inputSchema: { type: 'object', properties: { project: { type: 'string' }, full: { type: 'boolean', default: false } }, required: ['project'], additionalProperties: false },
    run: toolQaReport,
  },
  {
    name: 'vox_frame',
    description: 'Grab one frame of a rendered project as a PNG (for visual inspection).',
    inputSchema: { type: 'object', properties: { project: { type: 'string' }, time: { type: 'number', description: 'seconds into the video' }, full: { type: 'boolean', default: false }, out: { type: 'string', description: 'output path relative to the repo (optional)' } }, required: ['project', 'time'], additionalProperties: false },
    run: toolFrame,
  },
  {
    name: 'vox_speak',
    description: 'Synthesise narration audio with local Piper TTS (voice presets: narrator|news|warm|documentary).',
    inputSchema: { type: 'object', properties: { project: { type: 'string' }, voice: { type: 'string' }, dryRun: { type: 'boolean', default: false }, force: { type: 'boolean', default: false } }, required: ['project'], additionalProperties: false },
    run: toolSpeak,
  },
];

function rpc(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }
function rpcErr(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'); }

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    handle(msg).catch((e) => rpcErr(msg.id ?? null, -32603, String(e.message || e)));
  }
});

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return rpc(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'vox-studio', version: '1.0.0' },
    });
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;   // no id: no reply
  if (method === 'ping') return rpc(id, {});
  if (method === 'tools/list') {
    return rpc(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  }
  if (method === 'tools/call') {
    const name = params?.name;
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) return rpcErr(id, -32602, `unknown tool "${name}"`);
    let result;
    try { result = await tool.run(params?.arguments || {}); }
    catch (e) { return rpc(id, { content: [{ type: 'text', text: `error: ${e.message}` }], isError: true }); }
    return rpc(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
  }
  if (id !== undefined) return rpcErr(id, -32601, `method not found: ${method}`);
}

process.stdin.on('end', () => process.exit(0));
