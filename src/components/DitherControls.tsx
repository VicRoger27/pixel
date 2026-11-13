import React, { useEffect, useRef, useState } from 'react';
import { FlipHorizontal2, FlipVertical2, RefreshCw } from 'lucide-react';
import {
  DitherPattern,
  FillStyle,
  GradientDitherMode,
  NoiseMode,
  SymmetryBrushStyle,
  SymmetryGuideMode,
  ToolId,
} from '../types/pixel';
import { generateNoiseColor, spatialNoiseRand } from '../utils/color';
import { DITHER_PATTERNS, evalDitherPattern } from '../utils/dither';

interface PatternPreviewTileProps {
  pattern: DitherPattern;
  primaryColor: string;
  secondaryColor: string;
}

const PatternPreviewTile: React.FC<PatternPreviewTileProps> = ({
  pattern,
  primaryColor,
  secondaryColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 8, 8);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const usePrimary = evalDitherPattern(x, y, pattern);
        const color = usePrimary ? primaryColor : secondaryColor;
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [pattern, primaryColor, secondaryColor]);

  return (
    <canvas
      ref={canvasRef}
      width={8}
      height={8}
      className="w-8 h-8 rounded-sm pixelated checker-bg-sm border border-white/10 shrink-0"
    />
  );
};

interface NoisePreviewTileProps {
  primaryColor: string;
  secondaryColor: string;
  noiseMode: NoiseMode;
  noiseStrength: number;
  seed: number;
}

const NoisePreviewTile: React.FC<NoisePreviewTileProps> = ({
  primaryColor,
  secondaryColor,
  noiseMode,
  noiseStrength,
  seed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 8, 8);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        let step = 0;
        const color = generateNoiseColor(
          primaryColor,
          secondaryColor,
          noiseMode,
          noiseStrength,
          () => spatialNoiseRand(x * 13 + step++, y * 17 + seed, seed)
        );
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [primaryColor, secondaryColor, noiseMode, noiseStrength, seed]);

  return (
    <canvas
      ref={canvasRef}
      width={8}
      height={8}
      className="w-12 h-12 rounded-md pixelated checker-bg-sm border border-white/15 shrink-0"
    />
  );
};

interface DitherControlsProps {
  activeTool: ToolId;
  ditherPattern: DitherPattern;
  onSelectPattern: (p: DitherPattern) => void;
  gradientMode: GradientDitherMode;
  onSelectGradientMode: (m: GradientDitherMode) => void;
  fillStyle: FillStyle;
  onChangeFillStyle: (style: FillStyle) => void;
  symmetryBrushStyle: SymmetryBrushStyle;
  onChangeSymmetryBrushStyle: (style: SymmetryBrushStyle) => void;
  guideMode: SymmetryGuideMode;
  onChangeGuideMode: (mode: SymmetryGuideMode) => void;
  mirrorFollowsGuides: boolean;
  onToggleMirrorFollowsGuides: () => void;
  noiseMode: NoiseMode;
  onChangeNoiseMode: (mode: NoiseMode) => void;
  noiseStrength: number;
  onChangeNoiseStrength: (val: number) => void;
  brushSize: number;
  onChangeBrushSize: (s: number) => void;
  mirrorX: boolean;
  mirrorY: boolean;
  onToggleMirrorX: () => void;
  onToggleMirrorY: () => void;
  primaryColor: string;
  secondaryColor: string;
}

const GRADIENT_MODES: { id: GradientDitherMode; label: string }[] = [
  { id: 'bayer4', label: 'Bayer 4×4' },
  { id: 'bayer8', label: 'Bayer 8×8' },
  { id: 'bayer2', label: 'Bayer 2×2' },
  { id: 'floyd', label: 'Floyd-Steinberg' },
  { id: 'noise', label: 'Stochastic' },
];

const NOISE_MODES: { id: NoiseMode; label: string; desc: string }[] = [
  { id: 'shade', label: 'Shade Jitter', desc: 'Tonal depth' },
  { id: 'hue-shade', label: 'Color Scatter', desc: 'Hue + tone' },
  { id: 'blend', label: '2-Color Mix', desc: 'Pri & Sec' },
  { id: 'random', label: 'Full Random', desc: 'All hues' },
];

export const DitherControls: React.FC<DitherControlsProps> = ({
  activeTool,
  ditherPattern,
  onSelectPattern,
  gradientMode,
  onSelectGradientMode,
  fillStyle,
  onChangeFillStyle,
  symmetryBrushStyle,
  onChangeSymmetryBrushStyle,
  guideMode,
  onChangeGuideMode,
  mirrorFollowsGuides,
  onToggleMirrorFollowsGuides,
  noiseMode,
  onChangeNoiseMode,
  noiseStrength,
  onChangeNoiseStrength,
  brushSize,
  onChangeBrushSize,
  mirrorX,
  mirrorY,
  onToggleMirrorX,
  onToggleMirrorY,
  primaryColor,
  secondaryColor,
}) => {
  const [previewSeed, setPreviewSeed] = useState(1);

  const showBrushSize =
    activeTool === 'pencil' ||
    activeTool === 'dither' ||
    activeTool === 'noise' ||
    activeTool === 'symmetry' ||
    activeTool === 'eraser';
  const showFillStyle =
    activeTool === 'bucket' ||
    activeTool === 'rect' ||
    activeTool === 'circle' ||
    activeTool === 'line';
  const showNoisePanel =
    activeTool === 'noise' ||
    (activeTool === 'symmetry' && symmetryBrushStyle === 'noise') ||
    (showFillStyle && fillStyle === 'noise');

  return (
    <div className="flex flex-col gap-3.5 pt-3 border-t border-[#262B38]">
      {/* Brush Size & Symmetry */}
      <div className="flex items-center justify-between gap-2">
        {showBrushSize ? (
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-slate-400 mr-1">Size</span>
            {[1, 2, 3, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChangeBrushSize(s)}
                className={`px-1.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                  brushSize === s
                    ? 'bg-amber-400 text-[#111318] font-semibold'
                    : 'bg-[#171A22] border border-[#2A2F3D] text-slate-300 hover:text-white'
                }`}
              >
                {s}px
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs font-medium text-slate-400">Symmetry</span>
        )}

        {activeTool === 'symmetry' ? (
          <span className="text-[11px] font-medium text-amber-300 whitespace-nowrap shrink-0">
            Follows Guides
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleMirrorX}
              disabled={mirrorFollowsGuides}
              title="Mirror Horizontally"
              className={`inline-flex items-center gap-1 px-1.5 py-1 rounded text-xs border transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 ${
                mirrorX
                  ? 'bg-amber-500/20 border-amber-400/70 text-amber-200'
                  : 'bg-[#171A22] border-[#2A2F3D] text-slate-400 hover:text-slate-200'
              }`}
            >
              <FlipHorizontal2 className="w-3 h-3" />
              <span>X</span>
            </button>
            <button
              type="button"
              onClick={onToggleMirrorY}
              disabled={mirrorFollowsGuides}
              title="Mirror Vertically"
              className={`inline-flex items-center gap-1 px-1.5 py-1 rounded text-xs border transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 ${
                mirrorY
                  ? 'bg-amber-500/20 border-amber-400/70 text-amber-200'
                  : 'bg-[#171A22] border-[#2A2F3D] text-slate-400 hover:text-slate-200'
              }`}
            >
              <FlipVertical2 className="w-3 h-3" />
              <span>Y</span>
            </button>
            <button
              type="button"
              onClick={onToggleMirrorFollowsGuides}
              title="Automatically mirror all tools using active Symmetry Guides"
              className={`px-1.5 py-1 rounded text-[11px] border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                mirrorFollowsGuides
                  ? 'bg-sky-500/20 border-sky-400/70 text-sky-200 font-medium'
                  : 'bg-[#171A22] border-[#2A2F3D] text-slate-400 hover:text-slate-200'
              }`}
            >
              Auto
            </button>
          </div>
        )}
      </div>

      {/* Symmetry Brush Options */}
      {activeTool === 'symmetry' && (
        <div className="flex flex-col gap-2 bg-[#171A22] border border-[#2A2F3D] rounded-lg p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-300">Guide Axes</span>
            <div className="flex items-center gap-0.5 bg-[#101217] p-0.5 rounded-md border border-[#242834]">
              {(
                [
                  { id: 'off', label: 'Off' },
                  { id: 'vertical', label: 'V' },
                  { id: 'horizontal', label: 'H' },
                  { id: 'both', label: 'Both' },
                ] as { id: SymmetryGuideMode; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeGuideMode(opt.id)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                    guideMode === opt.id
                      ? opt.id === 'off'
                        ? 'bg-[#252A36] text-slate-100 font-medium'
                        : 'bg-amber-400 text-[#111318] font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-300">Stroke Style</span>
            <div className="flex items-center gap-0.5 bg-[#101217] p-0.5 rounded-md border border-[#242834]">
              {(['solid', 'dither', 'noise'] as SymmetryBrushStyle[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => onChangeSymmetryBrushStyle(style)}
                  className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors cursor-pointer ${
                    symmetryBrushStyle === style
                      ? 'bg-amber-400 text-[#111318] font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {guideMode === 'off' && (
            <p className="text-[11px] text-amber-300/90">
              Select V, H, or Both above to mirror strokes along guide lines.
            </p>
          )}
        </div>
      )}

      {/* Fill Style selector for Bucket & Shape tools */}
      {showFillStyle && (
        <div className="flex items-center justify-between gap-2 bg-[#171A22] border border-[#2A2F3D] rounded-lg px-2.5 py-1.5">
          <span className="text-xs font-medium text-slate-300">Fill Style</span>
          <div className="flex items-center gap-0.5 bg-[#101217] p-0.5 rounded-md border border-[#242834]">
            {(['solid', 'dither', 'noise'] as FillStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => onChangeFillStyle(style)}
                className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors cursor-pointer ${
                  fillStyle === style
                    ? 'bg-amber-400 text-[#111318] font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Noise / Random Color Texture Panel */}
      {showNoisePanel ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Color Noise</span>
            <button
              type="button"
              onClick={() => setPreviewSeed((s) => s + 1)}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Refresh sample tile"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reroll</span>
            </button>
          </div>

          <div className="flex items-center gap-3 bg-[#171A22] border border-[#2A2F3D] rounded-lg p-2.5">
            <NoisePreviewTile
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              noiseMode={noiseMode}
              noiseStrength={noiseStrength}
              seed={previewSeed}
            />
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Variation</span>
                <span className="font-mono text-amber-300">{noiseStrength}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={noiseStrength}
                onChange={(e) => onChangeNoiseStrength(Number(e.target.value))}
                aria-label="Noise variation strength"
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {NOISE_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangeNoiseMode(m.id)}
                className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                  noiseMode === m.id
                    ? 'bg-amber-500/15 border-amber-400/70 text-amber-100'
                    : 'bg-[#171A22] border-[#2A2F3D] text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="text-xs font-medium">{m.label}</div>
                <div className="text-[10px] text-slate-400">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>
      ) : activeTool === 'gradient' ? (
        /* Gradient Dither Mode Selector */
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Gradient Dither Matrix</span>
            <span className="text-[11px] text-slate-400">Drag on canvas</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {GRADIENT_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectGradientMode(m.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer ${
                  gradientMode === m.id
                    ? 'bg-amber-500/15 border-amber-400/70 text-amber-200'
                    : 'bg-[#171A22] border-[#2A2F3D] text-slate-300 hover:border-slate-500'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Live Visual Dither Pattern Grid */
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Dither Pattern</span>
            <span className="text-[11px] text-slate-400">
              {DITHER_PATTERNS.find((p) => p.id === ditherPattern)?.label}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {DITHER_PATTERNS.map((item) => {
              const selected = ditherPattern === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectPattern(item.id)}
                  title={`${item.label} (${item.density})`}
                  className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#222733] border-amber-400/80'
                      : 'bg-[#171A22] border-[#2A2F3D] hover:border-slate-500'
                  }`}
                >
                  <PatternPreviewTile
                    pattern={item.id}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-slate-200 truncate">
                      {item.label.split(' ')[0]}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {item.density}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
