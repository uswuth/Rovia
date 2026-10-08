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

export function getAvatarColorByName(name: string): string {
  if (!name) return AVATAR_COLOR_PALETTES[0];
  let charCodeSum = 0;
  for (let i = 0; i < name.length; i++) {
    charCodeSum += name.charCodeAt(i);
  }
  const index = Math.abs(charCodeSum) % AVATAR_COLOR_PALETTES.length;
  return AVATAR_COLOR_PALETTES[index];
}
