import {
  DitherPattern,
  FillStyle,
  GradientDitherMode,
  ImageDitherAlgorithm,
  NoiseMode,
  Point,
  RGB,
} from '../types/pixel';
import { findNearestPaletteColor, generateNoiseColor, hexToRgb } from './color';

export const BAYER_2X2 = [
  [0, 2],
  [3, 1],
];

export const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

export interface DitherPatternInfo {
  id: DitherPattern;
  label: string;
  density: string;
}

export const DITHER_PATTERNS: DitherPatternInfo[] = [
  { id: 'checker50', label: '50% Checker', density: '1:1' },
  { id: 'bayer25', label: '25% Sparse', density: '1:3' },
  { id: 'bayer75', label: '75% Dense', density: '3:1' },
  { id: 'bayer12', label: '12% Mist', density: '1:7' },
  { id: 'bayer88', label: '88% Heavy', density: '7:1' },
  { id: 'hstripe', label: 'Horizontal', density: 'Lines' },
  { id: 'vstripe', label: 'Vertical', density: 'Lines' },
  { id: 'diag', label: 'Diagonal', density: 'Hatch' },
  { id: 'noise', label: 'Fine Noise', density: '50%' },
];

/**
 * Deterministic spatial hash for repeatable fine noise.
 */
function hash2D(x: number, y: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * Returns true if pixel (x, y) should receive primaryColor, false for secondaryColor.
 */
export function evalDitherPattern(x: number, y: number, pattern: DitherPattern): boolean {
  const mx = ((x % 4) + 4) % 4;
  const my = ((y % 4) + 4) % 4;
  const b4 = BAYER_4X4[my][mx] / 16; // 0 .. 15/16

  switch (pattern) {
    case 'checker50':
      return ((x + y) & 1) === 0;
    case 'bayer25':
      return b4 < 0.25;
    case 'bayer75':
      return b4 < 0.75;
    case 'bayer12':
      return b4 < 0.125;
    case 'bayer88':
      return b4 < 0.875;
    case 'hstripe':
      return (my & 1) === 0;
    case 'vstripe':
      return (mx & 1) === 0;
    case 'diag':
      return ((x + y) % 3 + 3) % 3 === 0;
    case 'noise':
      return hash2D(x, y) < 0.5;
  }
}

export function getBresenhamLine(x0: number, y0: number, x1: number, y1: number): Point[] {
  const pts: Point[] = [];
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    pts.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return pts;
}

export function getRectPoints(x0: number, y0: number, x1: number, y1: number, filled: boolean): Point[] {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const pts: Point[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (filled || x === minX || x === maxX || y === minY || y === maxY) {
        pts.push({ x, y });
      }
    }
  }
  return pts;
}

export function getEllipsePoints(x0: number, y0: number, x1: number, y1: number, filled: boolean): Point[] {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = Math.max(0.5, (maxX - minX) / 2);
  const ry = Math.max(0.5, (maxY - minY) / 2);

  const pts: Point[] = [];
  const inside = (x: number, y: number) => {
    const nx = (x - cx) / (rx + 0.35);
    const ny = (y - cy) / (ry + 0.35);
    return nx * nx + ny * ny <= 1;
  };

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!inside(x, y)) continue;
      if (filled) {
        pts.push({ x, y });
      } else {
        const isEdge =
          !inside(x - 1, y) ||
          !inside(x + 1, y) ||
          !inside(x, y - 1) ||
          !inside(x, y + 1);
        if (isEdge) pts.push({ x, y });
      }
    }
  }
  return pts;
}

export function expandBrushPoints(cx: number, cy: number, size: number, width: number, height: number): Point[] {
  const pts: Point[] = [];
  const offset = Math.floor(size / 2);
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const x = cx - offset + dx;
      const y = cy - offset + dy;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        pts.push({ x, y });
      }
    }
  }
  return pts;
}

export function applySymmetry(
  pts: Point[],
  width: number,
  height: number,
  mirrorX: boolean,
  mirrorY: boolean
): Point[] {
  if (!mirrorX && !mirrorY) return pts;
  const out: Point[] = [];
  const seen = new Set<number>();

  const push = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const key = y * width + x;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ x, y });
    }
  };

  for (const p of pts) {
    push(p.x, p.y);
    if (mirrorX) push(width - 1 - p.x, p.y);
    if (mirrorY) push(p.x, height - 1 - p.y);
    if (mirrorX && mirrorY) push(width - 1 - p.x, height - 1 - p.y);
  }
  return out;
}

export function floodFillGrid(
  grid: string[],
  width: number,
  height: number,
  startX: number,
  startY: number,
  primaryColor: string,
  secondaryColor: string,
  fillStyle: FillStyle,
  pattern: DitherPattern,
  noiseMode: NoiseMode = 'shade',
  noiseStrength: number = 35
): string[] {
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return grid;
  const targetColor = grid[startY * width + startX];
  if (fillStyle === 'solid' && targetColor === primaryColor) return grid;

  const next = [...grid];
  const visited = new Uint8Array(width * height);
  const stack: number[] = [startY * width + startX];

  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (visited[idx]) continue;
    visited[idx] = 1;
    if (next[idx] !== targetColor) continue;

    const x = idx % width;
    const y = Math.floor(idx / width);

    if (fillStyle === 'dither') {
      next[idx] = evalDitherPattern(x, y, pattern) ? primaryColor : secondaryColor;
    } else if (fillStyle === 'noise') {
      next[idx] = generateNoiseColor(primaryColor, secondaryColor, noiseMode, noiseStrength);
    } else {
      next[idx] = primaryColor;
    }

    if (x > 0 && !visited[idx - 1]) stack.push(idx - 1);
    if (x < width - 1 && !visited[idx + 1]) stack.push(idx + 1);
    if (y > 0 && !visited[idx - width]) stack.push(idx - width);
    if (y < height - 1 && !visited[idx + width]) stack.push(idx + width);
  }

  return next;
}

/**
 * Generates a dithered gradient between start and end points across the entire grid
 * (or only replacing non-empty pixels if masked, here full canvas or contiguous is super clean).
 */
export function renderDitherGradient(
  grid: string[],
  width: number,
  height: number,
  start: Point,
  end: Point,
  primaryColor: string,
  secondaryColor: string,
  mode: GradientDitherMode
): string[] {
  const next = [...grid];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 0.5) {
    return next;
  }

  if (mode === 'floyd') {
    // Error-diffusion 1D/2D dither between primary (0) and secondary (1)
    const buf = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = ((x - start.x) * dx + (y - start.y) * dy) / lenSq;
        buf[y * width + x] = Math.max(0, Math.min(1, t));
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const oldVal = buf[i];
        const newVal = oldVal >= 0.5 ? 1 : 0;
        const err = oldVal - newVal;
        next[i] = newVal === 0 ? primaryColor : secondaryColor;

        if (x + 1 < width) buf[i + 1] += err * (7 / 16);
        if (y + 1 < height) {
          if (x > 0) buf[i + width - 1] += err * (3 / 16);
          buf[i + width] += err * (5 / 16);
          if (x + 1 < width) buf[i + width + 1] += err * (1 / 16);
        }
      }
    }
    return next;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rawT = ((x - start.x) * dx + (y - start.y) * dy) / lenSq;
      const t = Math.max(0, Math.min(1, rawT));

      let threshold = 0.5;
      if (mode === 'bayer2') {
        threshold = (BAYER_2X2[y % 2][x % 2] + 0.5) / 4;
      } else if (mode === 'bayer4') {
        threshold = (BAYER_4X4[y % 4][x % 4] + 0.5) / 16;
      } else if (mode === 'bayer8') {
        threshold = (BAYER_8X8[y % 8][x % 8] + 0.5) / 64;
      } else if (mode === 'noise') {
        threshold = hash2D(x * 7 + 3, y * 13 + 5);
      }

      next[y * width + x] = t < threshold ? primaryColor : secondaryColor;
    }
  }

  return next;
}

/**
 * Converts an RGBA ImageData buffer (already scaled to target width x height)
 * into a pixel-art string[] grid quantized to the given palette with dithering.
 */
export function ditherImageData(
  imageData: ImageData,
  paletteHexes: string[],
  algorithm: ImageDitherAlgorithm,
  ditherStrength: number, // 0..1
  brightness: number, // -50..50
  contrast: number // -50..50
): string[] {
  const { width, height, data } = imageData;
  const paletteRgb = paletteHexes.map((hex) => ({ hex, rgb: hexToRgb(hex) }));
  const result = new Array<string>(width * height).fill('');

  // Prepare working float RGB buffer with brightness & contrast adjustments
  const work = new Float32Array(width * height * 3);
  const alphaMask = new Uint8Array(width * height);
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3];
    if (a < 128) {
      alphaMask[i] = 0;
      continue;
    }
    alphaMask[i] = 1;

    for (let c = 0; c < 3; c++) {
      let val = data[i * 4 + c] + brightness * 1.5;
      val = contrastFactor * (val - 128) + 128;
      work[i * 3 + c] = Math.max(0, Math.min(255, val));
    }
  }

  if (algorithm === 'nearest') {
    for (let i = 0; i < width * height; i++) {
      if (!alphaMask[i]) continue;
      const rgb: RGB = {
        r: work[i * 3],
        g: work[i * 3 + 1],
        b: work[i * 3 + 2],
      };
      result[i] = findNearestPaletteColor(rgb, paletteRgb).hex;
    }
    return result;
  }

  if (algorithm === 'bayer4' || algorithm === 'bayer2') {
    const spread = 64 * ditherStrength;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!alphaMask[i]) continue;
        const bayerVal =
          algorithm === 'bayer4'
            ? BAYER_4X4[y % 4][x % 4] / 16 - 0.5
            : BAYER_2X2[y % 2][x % 2] / 4 - 0.5;
        const offset = bayerVal * spread;
        const rgb: RGB = {
          r: Math.max(0, Math.min(255, work[i * 3] + offset)),
          g: Math.max(0, Math.min(255, work[i * 3 + 1] + offset)),
          b: Math.max(0, Math.min(255, work[i * 3 + 2] + offset)),
        };
        result[i] = findNearestPaletteColor(rgb, paletteRgb).hex;
      }
    }
    return result;
  }

  // Error diffusion: Floyd-Steinberg or Atkinson
  const distribute = (x: number, y: number, er: number, eg: number, eb: number, weight: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (!alphaMask[idx]) return;
    work[idx * 3] = Math.max(0, Math.min(255, work[idx * 3] + er * weight));
    work[idx * 3 + 1] = Math.max(0, Math.min(255, work[idx * 3 + 1] + eg * weight));
    work[idx * 3 + 2] = Math.max(0, Math.min(255, work[idx * 3 + 2] + eb * weight));
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!alphaMask[i]) continue;

      const oldR = work[i * 3];
      const oldG = work[i * 3 + 1];
      const oldB = work[i * 3 + 2];

      const chosen = findNearestPaletteColor({ r: oldR, g: oldG, b: oldB }, paletteRgb);
      result[i] = chosen.hex;

      const er = (oldR - chosen.rgb.r) * ditherStrength;
      const eg = (oldG - chosen.rgb.g) * ditherStrength;
      const eb = (oldB - chosen.rgb.b) * ditherStrength;

      if (algorithm === 'floyd-steinberg') {
        distribute(x + 1, y, er, eg, eb, 7 / 16);
        distribute(x - 1, y + 1, er, eg, eb, 3 / 16);
        distribute(x, y + 1, er, eg, eb, 5 / 16);
        distribute(x + 1, y + 1, er, eg, eb, 1 / 16);
      } else {
        // Atkinson (1/8 to 6 neighbors = 6/8 diffused, classic crisp Macintosh contrast)
        const w = 1 / 8;
        distribute(x + 1, y, er, eg, eb, w);
        distribute(x + 2, y, er, eg, eb, w);
        distribute(x - 1, y + 1, er, eg, eb, w);
        distribute(x, y + 1, er, eg, eb, w);
        distribute(x + 1, y + 1, er, eg, eb, w);
        distribute(x, y + 2, er, eg, eb, w);
      }
    }
  }

  return result;
}
