import React, { useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';
import { PixelLayer } from '../types/pixel';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  layers: PixelLayer[];
  width: number;
  height: number;
}

const SCALES = [1, 4, 8, 16];

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  layers,
  width,
  height,
}) => {
  const [scale, setScale] = useState<number>(8);
  const [transparentBg, setTransparentBg] = useState<boolean>(true);
  const [bgColor, setBgColor] = useState<string>('#111318');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const renderExportCanvas = (): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    if (!transparentBg) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (const layer of layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const c = layer.grid[y * width + x];
          if (!c) continue;
          ctx.fillStyle = c;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
      ctx.restore();
    }
    return canvas;
  };

  const handleDownload = () => {
    const canvas = renderExportCanvas();
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixeldraft-${width}x${height}-${scale}x.png`;
    a.click();
    onClose();
  };

  const handleCopyPng = async () => {
    try {
      const canvas = renderExportCanvas();
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (blob && navigator.clipboard && 'ClipboardItem' in window) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // Fallback gracefully
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md bg-[#181B23] border border-[#2A2F3D] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#262B38]">
          <h2 className="text-sm font-semibold text-slate-100">Export PNG</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#232836] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Pixel Scale</span>
              <span className="font-mono text-slate-400">
                Output: {width * scale} × {height * scale} px
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SCALES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScale(s)}
                  className={`py-2 rounded-lg text-xs font-mono border transition-colors cursor-pointer ${
                    scale === s
                      ? 'bg-amber-400 border-amber-400 text-[#111318] font-semibold'
                      : 'bg-[#13161D] border-[#2A2F3D] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#13161D] border border-[#2A2F3D] rounded-lg px-3.5 py-2.5">
            <span className="text-xs font-medium text-slate-200">Transparent Background</span>
            <div className="flex items-center gap-2">
              {!transparentBg && (
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                  aria-label="Background color"
                />
              )}
              <button
                type="button"
                onClick={() => setTransparentBg(!transparentBg)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  transparentBg
                    ? 'bg-amber-400 text-[#111318]'
                    : 'bg-[#232836] text-slate-300 hover:text-white'
                }`}
              >
                {transparentBg ? 'Transparent' : 'Solid'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#262B38] bg-[#14171E]">
          <button
            type="button"
            onClick={handleCopyPng}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#1E2330] border border-[#2A2F3D] text-slate-200 hover:bg-[#272D3D] transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy PNG'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-400 text-[#111318] hover:bg-amber-300 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
};
