export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

export function mixHex(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return `rgb(${lerp(a.r, b.r, t)}, ${lerp(a.g, b.g, t)}, ${lerp(a.b, b.b, t)})`;
}

// 1 -> oxblood, 10/11 -> gold, 20 -> forest, blended lightly with the
// base parchment so the page stays readable, not fully re-colored.
export function colorForRoll(n) {
  const oxblood = '#6b2737', gold = '#c99a3f', forest = '#2c4a3b', parchment = '#e5d8b4';
  let accent;
  if (n <= 10) accent = mixHex(oxblood, gold, (n - 1) / 9);
  else accent = mixHex(gold, forest, (n - 11) / 9);
  return mixHex(parchment, accent.startsWith('rgb') ? rgbToHex(accent) : accent, 0.22);
}

export function rgbToHex(rgbStr) {
  const [r, g, b] = rgbStr.match(/\d+/g).map(Number);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
