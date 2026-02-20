const PERMUTATION: number[] = [];

function initPermutation(seed: number): void {
  const base: number[] = [];
  for (let i = 0; i < 256; i++) base[i] = i;

  let s = seed | 0;
  for (let i = 255; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }

  for (let i = 0; i < 512; i++) {
    PERMUTATION[i] = base[i & 255];
  }
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : -x;
  const v = h === 0 || h === 3 ? y : -y;
  return u + v;
}

let lastSeed = -1;

export function noise2d(x: number, y: number, seed: number): number {
  if (seed !== lastSeed) {
    initPermutation(seed);
    lastSeed = seed;
  }

  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  const aa = PERMUTATION[PERMUTATION[xi] + yi];
  const ab = PERMUTATION[PERMUTATION[xi] + yi + 1];
  const ba = PERMUTATION[PERMUTATION[xi + 1] + yi];
  const bb = PERMUTATION[PERMUTATION[xi + 1] + yi + 1];

  const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
  const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);

  return (lerp(x1, x2, v) + 1) * 0.5;
}

export function fbm(x: number, y: number, seed: number, octaves: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2d(x * frequency, y * frequency, seed);
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / total;
}