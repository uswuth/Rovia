export const AVATAR_COLOR_PALETTES = [
  'bg-emerald-700 text-white',
  'bg-blue-600 text-white',
  'bg-violet-600 text-white',
  'bg-amber-600 text-white',
  'bg-indigo-600 text-white',
  'bg-rose-600 text-white',
  'bg-cyan-600 text-white',
  'bg-teal-600 text-white',
  'bg-purple-600 text-white',
  'bg-pink-600 text-white',
  'bg-orange-600 text-white',
  'bg-sky-600 text-white',
];

export const AVATAR_TILE_BG_PALETTES = [
  'border border-emerald-800/40 bg-emerald-950/60',
  'border border-blue-800/40 bg-blue-950/60',
  'border border-violet-800/40 bg-violet-950/60',
  'border border-amber-800/40 bg-amber-950/60',
  'border border-indigo-800/40 bg-indigo-950/60',
  'border border-rose-800/40 bg-rose-950/60',
  'border border-cyan-800/40 bg-cyan-950/60',
  'border border-teal-800/40 bg-teal-950/60',
  'border border-purple-800/40 bg-purple-950/60',
  'border border-pink-800/40 bg-pink-950/60',
  'border border-orange-800/40 bg-orange-950/60',
  'border border-sky-800/40 bg-sky-950/60',
];

export function getAvatarColorByName(name: string): string {
  if (!name) return AVATAR_COLOR_PALETTES[0];
  let charCodeSum = 0;
  for (let i = 0; i < name.length; i++) {
    charCodeSum += name.charCodeAt(i);
  }
  const index = Math.abs(charCodeSum) % AVATAR_COLOR_PALETTES.length;
  return AVATAR_COLOR_PALETTES[index];
}

export function getAvatarTileBgByName(name: string): string {
  if (!name) return AVATAR_TILE_BG_PALETTES[0];
  let charCodeSum = 0;
  for (let i = 0; i < name.length; i++) {
    charCodeSum += name.charCodeAt(i);
  }
  const index = Math.abs(charCodeSum) % AVATAR_TILE_BG_PALETTES.length;
  return AVATAR_TILE_BG_PALETTES[index];
}

