# Prop protocol (read this before writing a prop)

A prop = folder `props/<category>/<name>/index.js` (kit) or `projects/<p>/props/<name>/index.js` (one-off).
Folder name MUST equal meta.name. Copy `props/_template`.

export default { meta, draw(ctx, o, env) }

meta (all required unless marked): name, use ("choose this when..."), avoid ("do not..."), slots, options,
  defaultDuration (s), example (copy-paste layer: {slots, options}).  Optional: category, space ('world'|'screen'),
  depth (0..1, default .5), enterEase (an easing name), enter (s).
Types: string | number | boolean | asset | color | length | array | object | any, suffix ? = optional,
  enum:a|b|c, range:0..1.   length = px, "50%", or {portrait:"50%", landscape:"30%"}.

o   = slots + options (x,y,w,h,r already resolved to px) + { appear, exit, opacity }.
      appear/exit are 0..1, already eased; transitions also get o.progress (0..1; 0.5 = fully covered).
env = { id, t, p, W, H, orientation, safe, theme, assets, words, rng(label), createCanvas, sprites }
      t = shot-local seconds, p = shot progress 0..1, words = spoken words with shot-local times.

Rules: pure (no Date/Math.random/DOM/globals; use env.rng); no hard-coded colors/fonts (theme); position = centre;
rot is in degrees; missing asset -> assets.get() returns a placeholder; text via fitText inside env.safe.
Memoize heavy pixels with sprite(env, key, w, h, paint); the key must include every input.
