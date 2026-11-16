// props/backgrounds/solidBg/index.js — flat colour (+ optional graph grid). Usage: {"prop":"solidBg","options":{"color":"kraft","grid":true}}
export default {
  meta: {
    name: 'solidBg',
    category: 'backgrounds',
    use: 'A plain colour (optionally graph-paper) backdrop when a shot needs no texture, photo, or map behind it.',
    avoid: 'Do not stack two backgrounds in one shot; do not use it where a handmade paper look is wanted (use paperBg).',
    slots: {},
    options: { color: 'string?', grid: 'boolean?', gridSize: 'range:20..400?' },
    defaultDuration: 4,
    depth: 0.1,
    example: { slots: {}, options: { color: 'paper', grid: true } },
  },
  draw(ctx, o, env) {
    const { W, H, theme } = env, c = theme.colors, B = 40;
    ctx.fillStyle = c[o.color] || o.color || c.paper;
    ctx.fillRect(-B, -B, W + 2 * B, H + 2 * B);
    if (!o.grid) return;
    const g = o.gridSize ?? 90;
    ctx.strokeStyle = c.ink; ctx.globalAlpha *= 0.09; ctx.lineWidth = theme.line.thin;
    ctx.beginPath();
    for (let x = -B; x <= W + B; x += g) { ctx.moveTo(x, -B); ctx.lineTo(x, H + B); }
    for (let y = -B; y <= H + B; y += g) { ctx.moveTo(-B, y); ctx.lineTo(W + B, y); }
    ctx.stroke();
  },
};
