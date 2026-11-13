export type ToolId =
  | 'pencil'
  | 'dither'
  | 'noise'
  | 'symmetry'
  | 'gradient'
  | 'bucket'
  | 'eraser'
  | 'eyedropper'
  | 'line'
  | 'rect'
  | 'circle';

export type SymmetryBrushStyle = 'solid' | 'dither' | 'noise';

export type DitherPattern =
  | 'checker50'
  | 'bayer25'
  | 'bayer75'
  | 'bayer12'
  | 'bayer88'
  | 'hstripe'
  | 'vstripe'
  | 'diag'
  | 'noise';

export type NoiseMode = 'shade' | 'hue-shade' | 'blend' | 'random';

export type FillStyle = 'solid' | 'dither' | 'noise';

export type GradientDitherMode = 'bayer4' | 'bayer8' | 'bayer2' | 'floyd' | 'noise';

export type ImageDitherAlgorithm =
  | 'floyd-steinberg'
  | 'atkinson'
  | 'bayer4'
  | 'bayer2'
  | 'nearest';

export type CanvasBackdrop = 'checker' | 'dark' | 'light';

export type SymmetryGuideMode = 'off' | 'vertical' | 'horizontal' | 'both';

export interface PalettePreset {
  id: string;
  name: string;
  colors: string[];
}

export interface Point {
  x: number;
  y: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSV {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

export interface PixelLayer {
  id: string;
  name: string;
  grid: string[];
  visible: boolean;
  opacity: number; // 0..100
}

export interface CanvasSnapshot {
  layers: PixelLayer[];
  activeLayerId: string;
}

