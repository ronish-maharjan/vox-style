// tests/mcp.test.mjs — the MCP server speaks the protocol and its tools work (P0.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from '../lib/registry.mjs';

const SERVER = path.join(ROOT, 'mcp/server.mjs');

/** Minimal MCP client over stdio. */
function client() {
  const p = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '', nextId = 1;
  const pending = new Map();
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', (d) => {
    buf += d;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try { const m = JSON.parse(line); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } catch { /* skip */ }
    }
  });
  p.stderr.on('data', () => { /* server logs go nowhere in tests */ });
  return {
    send(method, params) {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
        p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout')); } }, 60000);
      });
    },
    notify(method, params) { p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'); },
    close() { p.stdin.end(); p.kill(); },
  };
}

const text = (result) => JSON.parse(result.content[0].text);

test('MCP: initialize + tools/list exposes the 8 studio tools', async () => {
  const c = client();
  const init = await c.send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  assert.equal(init.serverInfo.name, 'vox-studio');
  assert.ok(init.capabilities.tools);
  c.notify('notifications/initialized');
  const list = await c.send('tools/list', {});
  const names = list.tools.map((t) => t.name);
  assert.deepEqual(names.sort(), ['vox_catalog', 'vox_compile', 'vox_frame', 'vox_qa_report', 'vox_slots', 'vox_speak', 'vox_validate', 'vox_video']);
  // every tool has a description and a JSON schema
  for (const t of list.tools) assert.ok(t.description && t.inputSchema.type === 'object', t.name);
  c.close();
});

test('MCP: vox_catalog returns props, recipes, formats', async () => {
  const c = client();
  await c.send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  const cat = text(await c.send('tools/call', { name: 'vox_catalog', arguments: {} }));
  assert.ok(cat.propsByCategory.data.some((p) => p.name === 'bigNumber'));
  assert.ok(cat.recipes.some((r) => r.name === 'stat-reveal'));
  assert.deepEqual(cat.formats, ['9:16', '16:9', '1:1', '4:5']);
  c.close();
});

test('MCP: vox_validate on the demo project returns JSON verdict', async () => {
  const c = client();
  await c.send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  const v = text(await c.send('tools/call', { name: 'vox_validate', arguments: { project: 'demo', draft: true } }));
  assert.deepEqual(v.errors, []);
  assert.ok(Array.isArray(v.warnings));
  c.close();
});

test('MCP: vox_compile + vox_video draft a project from an intent', { timeout: 120000 }, async () => {
  const c = client();
  await c.send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  const comp = text(await c.send('tools/call', {
    name: 'vox_compile',
    arguments: {
      project: 'mcp-e2e',
      intent: { meta: { title: 'MCP e2e' }, lines: [{ id: 'l1', text: 'The tower stands three hundred metres tall.', shots: [{ recipe: 'stat-reveal', params: { value: '300', label: 'metres tall' } }] }] },
    },
  }));
  assert.equal(comp.exit, 0, JSON.stringify(comp));
  const vid = text(await c.send('tools/call', { name: 'vox_video', arguments: { project: 'mcp-e2e', draftOnly: true, fromIntent: true } }));
  assert.equal(vid.ok, true, vid.output);
  assert.equal(vid.status.stages.validate.ok, true);
  assert.equal(vid.status.stages.draft.ok, true);
  const qa = text(await c.send('tools/call', { name: 'vox_qa_report', arguments: { project: 'mcp-e2e' } }));
  assert.equal(qa.ok, true);
  assert.ok(qa.shots.length >= 1);
  const frame = text(await c.send('tools/call', { name: 'vox_frame', arguments: { project: 'mcp-e2e', time: 1.0 } }));
  assert.match(frame.image, /\.png$/);
  c.close();
});

test('MCP: unknown tool returns a protocol error', async () => {
  const c = client();
  await c.send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  await assert.rejects(() => c.send('tools/call', { name: 'vox_nope', arguments: {} }), /unknown tool/);
  c.close();
});
