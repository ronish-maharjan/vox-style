// lib/fonts.mjs — fonts the studio uses (downloaded once by `npm run setup` into fonts/).
// If a URL ever breaks, drop a TTF with the same file name into fonts/ by hand.
const G = 'https://github.com/google/fonts/raw/main/ofl';
export const FONTS = [
  { family: 'Anton', file: 'Anton-Regular.ttf', url: `${G}/anton/Anton-Regular.ttf` },
  { family: 'Inter', file: 'Inter-Variable.ttf', url: `${G}/inter/Inter%5Bopsz%2Cwght%5D.ttf` },
  { family: 'Special Elite', file: 'SpecialElite-Regular.ttf', url: `${G}/specialelite/SpecialElite-Regular.ttf` },
  { family: 'Libre Baskerville', file: 'LibreBaskerville-Variable.ttf', url: `${G}/librebaskerville/LibreBaskerville%5Bwght%5D.ttf` },
];
