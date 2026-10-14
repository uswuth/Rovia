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
  'bg-emerald-950/70',
  'bg-blue-950/70',
  'bg-violet-950/70',
  'bg-amber-950/70',
  'bg-indigo-950/70',
  'bg-rose-950/70',
  'bg-cyan-950/70',
  'bg-teal-950/70',
  'bg-purple-950/70',
  'bg-pink-950/70',
  'bg-orange-950/70',
  'bg-sky-950/70',
];

export const AVATAR_TILE_BORDER_PALETTES = [
  'border border-emerald-800/40',
  'border border-blue-800/40',
  'border border-violet-800/40',
  'border border-amber-800/40',
  'border border-indigo-800/40',
  'border border-rose-800/40',
  'border border-cyan-800/40',
  'border border-teal-800/40',
  'border border-purple-800/40',
  'border border-pink-800/40',
  'border border-orange-800/40',
  'border border-sky-800/40',
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

export function getAvatarTileBorderByName(name: string): string {
  if (!name) return AVATAR_TILE_BORDER_PALETTES[0];
  let charCodeSum = 0;
  for (let i = 0; i < name.length; i++) {
    charCodeSum += name.charCodeAt(i);
  }
  const index = Math.abs(charCodeSum) % AVATAR_TILE_BORDER_PALETTES.length;
  return AVATAR_TILE_BORDER_PALETTES[index];
}

/**
 * High-contrast, vibrant, light active speaker border without dirty gray shadow/ring halos
 */
export const AVATAR_SPEAKER_BORDER_PALETTES = [
  'border border-emerald-400 ring-2 ring-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
  'border border-blue-400 ring-2 ring-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.25)]',
  'border border-violet-400 ring-2 ring-violet-500/40 shadow-[0_0_12px_rgba(139,92,246,0.25)]',
  'border border-amber-400 ring-2 ring-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
  'border border-indigo-400 ring-2 ring-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]',
  'border border-rose-400 ring-2 ring-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.25)]',
  'border border-cyan-400 ring-2 ring-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
  'border border-teal-400 ring-2 ring-teal-500/40 shadow-[0_0_12px_rgba(20,184,166,0.25)]',
  'border border-purple-400 ring-2 ring-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]',
  'border border-pink-400 ring-2 ring-pink-500/40 shadow-[0_0_12px_rgba(236,72,153,0.25)]',
  'border border-orange-400 ring-2 ring-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.25)]',
  'border border-sky-400 ring-2 ring-sky-500/40 shadow-[0_0_12px_rgba(14,165,233,0.25)]',
];

export const AVATAR_TEXT_ACCENT_PALETTES = [
  'text-emerald-400',
  'text-blue-400',
  'text-violet-400',
  'text-amber-400',
  'text-indigo-400',
  'text-rose-400',
  'text-cyan-400',
  'text-teal-400',
  'text-purple-400',
  'text-pink-400',
  'text-orange-400',
  'text-sky-400',
];

export function getAvatarSpeakerBorderByName(name: string): string {
  if (!name) return AVATAR_SPEAKER_BORDER_PALETTES[0];
  let charCodeSum = 0;
  for (let i = 0; i < name.length; i++) {
    charCodeSum += name.charCodeAt(i);
  }
  const index = Math.abs(charCodeSum) % AVATAR_SPEAKER_BORDER_PALETTES.length;
  return AVATAR_SPEAKER_BORDER_PALETTES[index];
}

export function getAvatarTextAccentByName(name: string): string {
  if (!name) return AVATAR_TEXT_ACCENT_PALETTES[0];
  let charCodeSum = 0;
  for (let i = 0; i < name.length; i++) {
    charCodeSum += name.charCodeAt(i);
  }
  const index = Math.abs(charCodeSum) % AVATAR_TEXT_ACCENT_PALETTES.length;
  return AVATAR_TEXT_ACCENT_PALETTES[index];
}
