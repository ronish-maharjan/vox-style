// preview/preview.js — scrubber page. Usage: npm run preview -> http://localhost:5173/preview/?project=demo
// Space = play/pause, arrows = step one frame. window.render(t) draws any time (used by capture later).
import { browserBackend } from '../backends/browser.js';
import { loadProject } from '../core/project.js';

const name = new URLSearchParams(location.search).get('project') || 'demo';
const $ = (id) => document.getElementById(id), canvas = $('c'), ctx = canvas.getContext('2d');
let S = null, T = 0, playing = false, lastNow = 0, fps = 30;

function fit() {
  if (!S) return;
  const r = $('stage').getBoundingClientRect(), { W, H } = S.theme.format, k = Math.min(r.width / W, r.height / H) * 0.98;
  canvas.style.width = `${W * k}px`; canvas.style.height = `${H * k}px`;
}

function draw() {
  if (!S) return;
  S.renderer.render(ctx, T);
  if ($('safe').checked) {
    const { safe, W, H, caption } = S.theme.format;
    ctx.save(); ctx.strokeStyle = '#ff00aa'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    ctx.strokeRect(safe.left, safe.top, W - safe.left - safe.right, H - safe.top - safe.bottom);
    ctx.beginPath(); ctx.moveTo(0, caption.y); ctx.lineTo(W, caption.y); ctx.stroke(); ctx.restore();
  }
  $('t').value = T;
  $('clock').textContent = `${T.toFixed(2)} / ${S.renderer.duration.toFixed(2)}s  shot ${S.renderer.shotAt(T).index + 1}`;
}

async function boot(aspect) {
  const info = $('info');
  try {
    const be = browserBackend(`/projects/${name}/`);
    const { props } = await import(`/projects/${name}/registry.generated.js`);
    S = await loadProject({ ...be, props, aspect, strict: false });
    await Promise.all(['Anton', 'Inter', 'Special Elite', 'Libre Baskerville'].map((f) => document.fonts.load(`40px "${f}"`)));
    fps = S.script.meta?.fps || 30;
    const { W, H } = S.theme.format;
    canvas.width = W; canvas.height = H;
    $('t').max = S.renderer.duration; $('t').step = 1 / fps; $('aspect').value = S.aspect;
    const bits = [`${S.renderer.duration.toFixed(1)}s`, `${S.timeline.shots.length} shots`, `${Object.keys(props).length} props`];
    if (S.estimated) bits.push('⚠ ESTIMATED TIMING (no words.json)');
    if (S.missing.length) bits.push(`⚠ missing assets: ${S.missing.map((m) => m.name).join(', ')}`);
    info.textContent = bits.join(' · '); info.className = bits.some((b) => b.startsWith('⚠')) ? 'warn' : '';
    T = Math.min(T, S.renderer.duration);
    fit(); draw();
  } catch (e) { S = null; info.textContent = `ERROR: ${e.message}`; info.className = 'err'; console.error(e); }
}

function tick(now) {
  if (!playing) return;
  T += (now - lastNow) / 1000; lastNow = now;
  if (T >= S.renderer.duration) { T = S.renderer.duration; playing = false; $('play').textContent = '▶'; }
  draw();
  if (playing) requestAnimationFrame(tick);
}
function toggle() {
  if (!S) return;
  playing = !playing; $('play').textContent = playing ? '❚❚' : '▶';
  if (playing) { if (T >= S.renderer.duration) T = 0; lastNow = performance.now(); requestAnimationFrame(tick); }
}

$('play').onclick = toggle;
$('t').oninput = (e) => { T = Number(e.target.value); draw(); };
$('safe').onchange = draw;
$('aspect').onchange = (e) => boot(e.target.value);
addEventListener('resize', fit);
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  if (e.code === 'ArrowRight') { T = Math.min(S.renderer.duration, T + 1 / fps); draw(); }
  if (e.code === 'ArrowLeft') { T = Math.max(0, T - 1 / fps); draw(); }
});
window.render = (t) => { T = t; draw(); };
window.studio = () => S;
boot(new URLSearchParams(location.search).get('aspect') || undefined);
