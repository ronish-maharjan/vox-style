// Finds narration and music files for a project. Usage: audioFiles(projectDir), findMusic(projectDir, root)
import fs from 'node:fs';
import path from 'node:path';

export const AUDIO_EXT = /\.(wav|mp3|m4a|aac|ogg|flac|opus)$/i;
export const stem = (f) => f.replace(/\.[^.]+$/, '');

export function audioFiles(dir) {
  const d = path.join(dir, 'audio');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => AUDIO_EXT.test(f) && !/^(music|sfx)/i.test(f)).sort();
}

export function findMusic(dir, root) {
  for (const d of [path.join(dir, 'audio'), dir, path.join(root, 'assets')]) {
    if (!fs.existsSync(d)) continue;
    const f = fs.readdirSync(d).find((x) => /^music\.(mp3|wav|m4a|ogg|flac|opus)$/i.test(x));
    if (f) return path.join(d, f);
  }
  return null;
}
