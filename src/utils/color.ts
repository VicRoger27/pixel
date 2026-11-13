import { HSV, NoiseMode, PalettePreset, RGB } from '../types/pixel';

export const CURATED_PALETTES: PalettePreset[] = [
  {
    id: 'pico8',
    name: 'PICO-8',
    colors: [
      '#000000', '#1D2B53', '#7E2553', '#008751',
      '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
      '#FF004D', '#FFA300', '#FFEC27', '#00E436',
      '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA',
    ],
  },
  {
    id: 'endesga32',
    name: 'Endesga 32',
    colors: [
      '#BE4A2F', '#D77643', '#EAD4AA', '#E4A672',
      '#B86F50', '#733E39', '#3E2731', '#A22633',
      '#E43B44', '#F77622', '#FEAE34', '#FEE761',
      '#63C74D', '#3E8948', '#265C42', '#193C3E',
      '#124E89', '#0099DB', '#2CE8F5', '#FFFFFF',
      '#C0CBDC', '#8B9BB4', '#5A6988', '#3A4466',
      '#262B44', '#181425', '#FF0044', '#68386C',
      '#B55088', '#F6757A', '#E8B796', '#C28569',
    ],
  },
  {
    id: 'gameboy',
    name: 'Game Boy',
    colors: ['#0F380F', '#306230', '#8BAC0F', '#9BBC0F'],
  },
  {
    id: 'onebit',
    name: '1-Bit Ink',
    colors: ['#15151C', '#F2EFE9'],
  },
  {
    id: 'pastel',
    name: 'Soft Pastel',
    colors: [
      '#2E294E', '#541388', '#F1E9DA', '#FFD400',
      '#D90368', '#FF9F1C', '#FFBF69', '#CBF3F0',
      '#2EC4B6', '#A0C4FF', '#BDB2FF', '#FFC6FF',
      '#FDFFB6', '#CAFFBF', '#9BF6FF', '#FFADAD',
    ],
  },
  {
    id: 'cga',
    name: 'Retro CGA',
    colors: [
      '#000000', '#0000AA', '#00AA00', '#00AAAA',
      '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA',
      '#555555', '#5555FF', '#55FF55', '#55FFFF',
      '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF',
    ],
  },
];

export function getHexAlpha(hex: string): number {
  if (!hex) return 0;
  const cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length === 8) {
    const a = parseInt(cleaned.slice(6, 8), 16);
    if (!Number.isNaN(a)) return Math.round((a / 255) * 100);
  }
  return 100;
}

export function stripHexAlpha(hex: string): string {
  if (!hex) return '';
  const cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length >= 6) {
    return `#${cleaned.slice(0, 6)}`.toUpperCase();
  }
  return hex.toUpperCase();
}

export function withHexAlpha(hex: string, alphaPercent: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(alphaPercent)));
  if (!hex || clamped <= 0) return '';
  const base = stripHexAlpha(hex);
  if (clamped >= 100) return base;
  const aa = Math.round((clamped / 100) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `${base}${aa}`;
}

export function normalizeHex(input: string): string | null {
  const cleaned = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = cleaned[0] + cleaned[0];
    const g = cleaned[1] + cleaned[1];
    const b = cleaned[2] + cleaned[2];
    return `#${r}${g}${b}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{8}$/.test(cleaned)) {
    const alpha = parseInt(cleaned.slice(6, 8), 16);
    if (alpha <= 0) return '';
    if (alpha >= 255) return `#${cleaned.slice(0, 6)}`.toUpperCase();
    return `#${cleaned}`.toUpperCase();
  }
  return null;
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '').slice(0, 6);
  const n = parseInt(clean || '000000', 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }

  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;

  return { h, s, v };
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const vn = Math.max(0, Math.min(100, v)) / 100;

  const c = vn * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = vn - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (hn < 60) {
    rp = c; gp = x; bp = 0;
  } else if (hn < 120) {
    rp = x; gp = c; bp = 0;
  } else if (hn < 180) {
    rp = 0; gp = c; bp = x;
  } else if (hn < 240) {
    rp = 0; gp = x; bp = c;
  } else if (hn < 300) {
    rp = x; gp = 0; bp = c;
  } else {
    rp = c; gp = 0; bp = x;
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

export function hexToHsv(hex: string): HSV {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

export function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

/**
 * Generates a 5-step hue-shifted pixel art shading ramp centered on the given hex color:
 * [deep shadow, shadow, base, highlight, bright highlight]
 * Cool-shifts shadows toward violet/blue (240deg) and warm-shifts highlights toward yellow (55deg).
 */
export function generatePixelRamp(hex: string): string[] {
  const base = hexToHsv(hex);

  const shiftHueTowards = (h: number, target: number, amount: number): number => {
    let diff = target - h;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return (h + diff * amount + 360) % 360;
  };

  const step = (deltaV: number, deltaS: number, targetHue: number, hueAmt: number) => {
    const newV = Math.max(8, Math.min(98, base.v + deltaV));
    const newS = base.s < 4 ? base.s : Math.max(6, Math.min(98, base.s + deltaS));
    const newH = base.s < 6 ? base.h : shiftHueTowards(base.h, targetHue, hueAmt);
    return hsvToHex(newH, newS, newV);
  };

  return [
    step(-36, +12, 245, 0.28),
    step(-18, +6, 245, 0.14),
    hex.toUpperCase(),
    step(+16, -8, 52, 0.14),
    step(+32, -18, 52, 0.28),
  ];
}

/**
 * Finds a harmonious darker or lighter neighbor for instant 2-color dithering.
 */
export function suggestDitherPartner(hex: string): string {
  const hsv = hexToHsv(hex);
  const ramp = generatePixelRamp(hex);
  // If color is bright, pair with shadow; if dark, pair with highlight
  return hsv.v > 52 ? ramp[1] : ramp[3];
}

/**
 * Weighted perceptual RGB distance for clean color quantization.
 */
export function colorDistanceSq(a: RGB, b: RGB): number {
  const rMean = (a.r + b.r) * 0.5;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
}

export function findNearestPaletteColor(rgb: RGB, paletteRgb: { hex: string; rgb: RGB }[]): { hex: string; rgb: RGB } {
  let best = paletteRgb[0];
  let bestDist = Infinity;
  for (let i = 0; i < paletteRgb.length; i++) {
    const d = colorDistanceSq(rgb, paletteRgb[i].rgb);
    if (d < bestDist) {
      bestDist = d;
      best = paletteRgb[i];
    }
  }
  return best;
}

/**
 * Generates a deterministic pseudo-random generator for stable shape previews.
 */
export function spatialNoiseRand(x: number, y: number, seed: number): number {
  let n = Math.imul(x + 17, 374761393) + Math.imul(y + 31, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * Generates a noisy/jittered color around primaryHex (and optionally secondaryHex)
 * matching pixel-art texture noise (e.g. grass, foliage, stone, confetti).
 */
export function generateNoiseColor(
  primaryHex: string,
  secondaryHex: string,
  mode: NoiseMode,
  strengthPercent: number, // 0..100
  randFn: () => number = Math.random
): string {
  const s = Math.max(0.05, Math.min(1, strengthPercent / 100));
  const primaryAlpha = primaryHex ? getHexAlpha(primaryHex) : 100;

  if (mode === 'random') {
    if (randFn() > s * 0.9 + 0.1 && primaryHex) {
      // Blend partial random when strength is low
      const base = hexToHsv(primaryHex);
      const h = (base.h + (randFn() - 0.5) * 360 * s + 360) % 360;
      const sat = Math.max(15, Math.min(98, base.s + (randFn() - 0.5) * 80 * s));
      const val = Math.max(15, Math.min(98, base.v + (randFn() - 0.5) * 80 * s));
      return withHexAlpha(hsvToHex(h, sat, val), primaryAlpha);
    }
    const h = randFn() * 360;
    const sat = 45 + randFn() * 50;
    const val = 28 + randFn() * 68;
    return withHexAlpha(hsvToHex(h, sat, val), primaryAlpha);
  }

  if (!primaryHex) return '';

  if (mode === 'blend') {
    if (!secondaryHex) {
      // Fade randomly between primary color and transparent
      return randFn() < 0.5 + (0.5 - s * 0.45) ? primaryHex : '';
    }
    const c1 = hexToRgb(primaryHex);
    const c2 = hexToRgb(secondaryHex);
    const a1 = getHexAlpha(primaryHex);
    const a2 = getHexAlpha(secondaryHex);
    const t = randFn();
    // Bias toward primary/secondary extremes at higher strength
    const mix = Math.max(0, Math.min(1, 0.5 + (t - 0.5) * (0.4 + s * 0.8)));
    const blendedHex = rgbToHex(
      c1.r + (c2.r - c1.r) * mix,
      c1.g + (c2.g - c1.g) * mix,
      c1.b + (c2.b - c1.b) * mix
    );
    return withHexAlpha(blendedHex, a1 + (a2 - a1) * mix);
  }

  const base = hexToHsv(primaryHex);
  const r1 = randFn() * 2 - 1; // -1..1
  const r2 = randFn() * 2 - 1;
  const r3 = randFn() * 2 - 1;

  if (mode === 'hue-shade') {
    const h = (base.h + r1 * 85 * s + 360) % 360;
    const sat = Math.max(8, Math.min(100, base.s + r2 * 28 * s));
    const val = Math.max(8, Math.min(100, base.v + r3 * 42 * s));
    return withHexAlpha(hsvToHex(h, sat, val), primaryAlpha);
  }

  // Default: 'shade' — organic tonal noise like emerald foliage/tile grids
  const valDelta = r1 * 48 * s;
  // Slightly cool-shift darker shades & warm-shift brighter shades for natural pixel art feel
  const hueShift = r2 * 14 * s + (valDelta < 0 ? 5 * s : -4 * s);
  const satDelta = r3 * 22 * s - valDelta * 0.15;

  const h = (base.h + hueShift + 360) % 360;
  const sat = base.s < 4 ? base.s : Math.max(8, Math.min(100, base.s + satDelta));
  const val = Math.max(6, Math.min(100, base.v + valDelta));
  return withHexAlpha(hsvToHex(h, sat, val), primaryAlpha);
}

/**
 * Composites topHex (with optional topLayerOpacity 0..100) over bottomHex using Porter-Duff source-over.
 */
export function compositeHexOver(
  bottomHex: string,
  topHex: string,
  topLayerOpacity: number = 100
): string {
  if (!topHex) return bottomHex;
  const topA = (getHexAlpha(topHex) / 100) * (topLayerOpacity / 100);
  if (topA <= 0) return bottomHex;
  if (!bottomHex) {
    return withHexAlpha(topHex, Math.round(topA * 100));
  }
  const botA = getHexAlpha(bottomHex) / 100;
  const outA = topA + botA * (1 - topA);
  if (outA <= 0) return '';

  const topRgb = hexToRgb(topHex);
  const botRgb = hexToRgb(bottomHex);
  const r = (topRgb.r * topA + botRgb.r * botA * (1 - topA)) / outA;
  const g = (topRgb.g * topA + botRgb.g * botA * (1 - topA)) / outA;
  const b = (topRgb.b * topA + botRgb.b * botA * (1 - topA)) / outA;

  return withHexAlpha(rgbToHex(r, g, b), Math.round(outA * 100));
}


