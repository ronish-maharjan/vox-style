// align.config.json loader (defaults merged with the user's file).
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULTS = {
  model: 'small.en',      // base.en (fast) | small.en | medium.en (best)
  device: 'cpu',
  computeType: 'int8',
  beam: 5,
  usePrompt: true,        // feed the script text to Whisper as a spelling hint
  lead: 0.3,              // seconds of silence before the first word
  lineGap: 0.35,          // silence inserted between per-line files
  tail: 0.4,
  maxGap: 0.8,            // warn on silences longer than this inside a line
  minLineConfidence: 0.6,
  cueMinConfidence: 0.6,  // a word: cue below this blocks words.json
};

export function loadAlignConfig(root) {
  const f = path.join(root, 'align.config.json');
  const user = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  return { ...DEFAULTS, ...user };
}
