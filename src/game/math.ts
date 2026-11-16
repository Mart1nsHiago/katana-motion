import type { Point } from './types';

export function segmentCircleHit(a: Point, b: Point, center: Point, radius: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((center.x - a.x) * dx + (center.y - a.y) * dy) / lengthSquared))
    : 0;
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return (center.x - px) ** 2 + (center.y - py) ** 2 <= radius ** 2;
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailySeed(): number {
  const key = new Date().toISOString().slice(0, 10);
  return [...key].reduce((hash, char) => Math.imul(hash, 31) + char.charCodeAt(0), 37);
}
