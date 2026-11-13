import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import { ImageDitherAlgorithm } from '../types/pixel';
import { CURATED_PALETTES } from '../utils/color';
import { ditherImageData } from '../utils/dither';

interface ImportDitherModalProps {
  isOpen: boolean;
  onClose: () => void;
  gridWidth: number;
  gridHeight: number;
  activePaletteId: string;
  customColors: string[];
  onApplyGrid: (nextGrid: string[]) => void;
}

const ALGORITHMS: { id: ImageDitherAlgorithm; label: string; desc: string }[] = [
  { id: 'floyd-steinberg', label: 'Floyd-Steinberg', desc: 'Smooth organic error diffusion' },
  { id: 'atkinson', label: 'Atkinson', desc: 'Crisp high-contrast retro diffusion' },
  { id: 'bayer4', label: 'Bayer 4×4', desc: 'Classic ordered crosshatch pattern' },
  { id: 'bayer2', label: 'Bayer 2×2', desc: 'Bold tight checkerboard pattern' },
  { id: 'nearest', label: 'No Dither', desc: 'Flat nearest palette match' },
];

export const ImportDitherModal: React.FC<ImportDitherModalProps> = ({
  isOpen,
  onClose,
  gridWidth,
  gridHeight,
  activePaletteId,
  customColors,
  onApplyGrid,
}) => {
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [algorithm, setAlgorithm] = useState<ImageDitherAlgorithm>('floyd-steinberg');
  const [paletteId, setPaletteId] = useState<string>(activePaletteId);
  const [ditherStrength, setDitherStrength] = useState<number>(85);
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(8);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPaletteId(activePaletteId);
    }
  }, [isOpen, activePaletteId]);

  const targetPaletteColors = useMemo(() => {
    if (paletteId === 'custom' && customColors.length > 0) return customColors;
    return (CURATED_PALETTES.find((p) => p.id === paletteId) ?? CURATED_PALETTES[0]).colors;
  }, [paletteId, customColors]);

  const ditheredResult = useMemo(() => {
    if (!sourceImg) return null;
    const offscreen = document.createElement('canvas');
    offscreen.width = gridWidth;
    offscreen.height = gridHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    // Cover-crop center fit
    const srcRatio = sourceImg.width / sourceImg.height;
    const dstRatio = gridWidth / gridHeight;
    let sx = 0;
    let sy = 0;
    let sw = sourceImg.width;
    let sh = sourceImg.height;
    if (srcRatio > dstRatio) {
      sw = sourceImg.height * dstRatio;
      sx = (sourceImg.width - sw) / 2;
    } else {
      sh = sourceImg.width / dstRatio;
      sy = (sourceImg.height - sh) / 2;
    }

    ctx.drawImage(sourceImg, sx, sy, sw, sh, 0, 0, gridWidth, gridHeight);
    const imgData = ctx.getImageData(0, 0, gridWidth, gridHeight);
    return ditherImageData(
      imgData,
      targetPaletteColors,
      algorithm,
      ditherStrength / 100,
      brightness,
      contrast
    );
  }, [sourceImg, gridWidth, gridHeight, targetPaletteColors, algorithm, ditherStrength, brightness, contrast]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !ditheredResult) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, gridWidth, gridHeight);
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const c = ditheredResult[y * gridWidth + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [ditheredResult, gridWidth, gridHeight]);

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setSourceImg(img);
        setFileName(file.name);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl bg-[#181B23] border border-[#2A2F3D] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#262B38]">
          <div className="flex items-center gap-2.5">
            <ImagePlus className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Import & Dither Image ({gridWidth}×{gridHeight})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#232836] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left: Upload / Preview */}
          <div className="flex flex-col gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            {!sourceImg ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                className="h-64 rounded-xl border border-dashed border-[#384054] bg-[#13161D] hover:border-amber-400/70 hover:bg-[#161A23] transition-colors flex flex-col items-center justify-center gap-2.5 p-4 text-center cursor-pointer"
              >
                <Upload className="w-7 h-7 text-amber-400" />
                <div className="text-sm font-medium text-slate-200">
                  Choose or drop an image
                </div>
                <div className="text-xs text-slate-400">
                  PNG, JPG, or WebP · Auto-dithered to {gridWidth}×{gridHeight}
                </div>
              </button>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="h-64 rounded-xl border border-[#2A2F3D] checker-bg flex items-center justify-center p-3 overflow-hidden">
                  <canvas
                    ref={previewCanvasRef}
                    width={gridWidth}
                    height={gridHeight}
                    className="w-56 h-56 pixelated shadow-lg ring-1 ring-white/10"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="truncate max-w-[180px]">{fileName}</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-amber-300 hover:text-amber-200 font-medium cursor-pointer"
                  >
                    Change image
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Dither Controls */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Dithering Algorithm
              </label>
              <div className="flex flex-col gap-1">
                {ALGORITHMS.map((alg) => (
                  <button
                    key={alg.id}
                    type="button"
                    onClick={() => setAlgorithm(alg.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      algorithm === alg.id
                        ? 'bg-amber-500/15 border-amber-400/70 text-amber-100'
                        : 'bg-[#13161D] border-[#2A2F3D] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span className="text-xs font-medium">{alg.label}</span>
                    <span className="text-[11px] text-slate-400">{alg.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Target Palette</label>
              <select
                value={paletteId}
                onChange={(e) => setPaletteId(e.target.value)}
                className="bg-[#13161D] border border-[#2A2F3D] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400/70 cursor-pointer"
              >
                {CURATED_PALETTES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.colors.length} colors)
                  </option>
                ))}
                {customColors.length > 0 && (
                  <option value="custom">Saved Swatches ({customColors.length} colors)</option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Dither</span>
                  <span className="font-mono text-slate-200">{ditherStrength}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={ditherStrength}
                  onChange={(e) => setDitherStrength(Number(e.target.value))}
                  className="accent-amber-400 cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Bright</span>
                  <span className="font-mono text-slate-200">{brightness}</span>
                </div>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="accent-amber-400 cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Contrast</span>
                  <span className="font-mono text-slate-200">{contrast}</span>
                </div>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="accent-amber-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#262B38] bg-[#14171E]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-[#232836] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ditheredResult}
            onClick={() => {
              if (ditheredResult) {
                onApplyGrid(ditheredResult);
                onClose();
              }
            }}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-400 text-[#111318] hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Apply to Canvas
          </button>
        </div>
      </div>
    </div>
  );
};
