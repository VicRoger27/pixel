import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Eraser, Plus, Sparkles } from 'lucide-react';
import {
  CURATED_PALETTES,
  generatePixelRamp,
  getHexAlpha,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  stripHexAlpha,
  suggestDitherPartner,
  withHexAlpha,
} from '../utils/color';

interface ColorStudioProps {
  primaryColor: string;
  secondaryColor: string; // '' means transparent
  onChangePrimary: (color: string) => void;
  onChangeSecondary: (color: string) => void;
  onSwapColors: () => void;
  activePaletteId: string;
  onSelectPaletteId: (id: string) => void;
  customColors: string[];
  onAddCustomColor: (color: string) => void;
}

const OPACITY_PRESETS = [25, 50, 75, 100];

export const ColorStudio: React.FC<ColorStudioProps> = ({
  primaryColor,
  secondaryColor,
  onChangePrimary,
  onChangeSecondary,
  onSwapColors,
  activePaletteId,
  onSelectPaletteId,
  customColors,
  onAddCustomColor,
}) => {
  const [editingSlot, setEditingSlot] = useState<'primary' | 'secondary'>('primary');
  const activeSlotRaw = editingSlot === 'primary' ? primaryColor : secondaryColor;
  const activeOpacity = getHexAlpha(activeSlotRaw);

  const lastBaseHexRef = useRef<{ primary: string; secondary: string }>({
    primary: stripHexAlpha(primaryColor) || '#FF004D',
    secondary: stripHexAlpha(secondaryColor) || '#FFA300',
  });

  useEffect(() => {
    if (primaryColor) lastBaseHexRef.current.primary = stripHexAlpha(primaryColor);
  }, [primaryColor]);

  useEffect(() => {
    if (secondaryColor) lastBaseHexRef.current.secondary = stripHexAlpha(secondaryColor);
  }, [secondaryColor]);

  const activeBaseHex =
    stripHexAlpha(activeSlotRaw) || lastBaseHexRef.current[editingSlot];

  const [hsv, setHsv] = useState(() => hexToHsv(activeBaseHex));
  const [hexInput, setHexInput] = useState(activeSlotRaw || 'TRANSPARENT');

  const svSquareRef = useRef<HTMLDivElement>(null);
  const hueBarRef = useRef<HTMLDivElement>(null);
  const draggingSV = useRef(false);
  const draggingHue = useRef(false);

  // Sync HSV & hex input when external color or slot changes
  useEffect(() => {
    const target = editingSlot === 'primary' ? primaryColor : secondaryColor;
    setHexInput(target || 'EMPTY');
    if (!target) return;
    const parsed = hexToHsv(target);
    setHsv((prev) => ({
      h: parsed.s < 1 ? prev.h : parsed.h,
      s: parsed.s,
      v: parsed.v,
    }));
  }, [primaryColor, secondaryColor, editingSlot]);

  const applyColorToSlot = (
    hex: string,
    slot: 'primary' | 'secondary' = editingSlot,
    preserveOpacity = true
  ) => {
    const targetRaw = slot === 'primary' ? primaryColor : secondaryColor;
    const currentAlpha = getHexAlpha(targetRaw);
    const nextAlpha = preserveOpacity && currentAlpha > 0 ? currentAlpha : 100;
    const finalHex = hex ? withHexAlpha(hex, nextAlpha) : '';
    if (slot === 'primary') {
      onChangePrimary(finalHex);
    } else {
      onChangeSecondary(finalHex);
    }
  };

  const handleOpacityChange = (nextOpacity: number) => {
    const minAlpha = editingSlot === 'primary' ? 5 : 0;
    const clamped = Math.max(minAlpha, Math.min(100, nextOpacity));
    const base = stripHexAlpha(activeSlotRaw) || lastBaseHexRef.current[editingSlot];
    const nextColor = withHexAlpha(base, clamped);
    if (editingSlot === 'primary') {
      onChangePrimary(nextColor);
    } else {
      onChangeSecondary(nextColor);
    }
  };

  const updateFromHsv = (nextH: number, nextS: number, nextV: number) => {
    setHsv({ h: nextH, s: nextS, v: nextV });
    const baseHex = hsvToHex(nextH, nextS, nextV);
    const nextAlpha = activeOpacity > 0 ? activeOpacity : 100;
    const finalHex = withHexAlpha(baseHex, nextAlpha);
    setHexInput(finalHex);
    if (editingSlot === 'primary') {
      onChangePrimary(finalHex);
    } else {
      onChangeSecondary(finalHex);
    }
  };

  const handleSVPointer = (clientX: number, clientY: number) => {
    const el = svSquareRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const v = Math.max(0, Math.min(100, (1 - (clientY - rect.top) / rect.height) * 100));
    updateFromHsv(hsv.h, s, v);
  };

  const handleHuePointer = (clientX: number) => {
    const el = hueBarRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = Math.max(0, Math.min(359.9, ((clientX - rect.left) / rect.width) * 360));
    updateFromHsv(h, hsv.s, hsv.v);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (draggingSV.current) handleSVPointer(e.clientX, e.clientY);
      if (draggingHue.current) handleHuePointer(e.clientX);
    };
    const onUp = () => {
      draggingSV.current = false;
      draggingHue.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });

  const rampColors = useMemo(() => generatePixelRamp(activeBaseHex), [activeBaseHex]);

  const activePalette = useMemo(() => {
    if (activePaletteId === 'custom') {
      return { id: 'custom', name: 'Saved Swatches', colors: customColors };
    }
    return CURATED_PALETTES.find((p) => p.id === activePaletteId) ?? CURATED_PALETTES[0];
  }, [activePaletteId, customColors]);

  const handleHexCommit = () => {
    const valid = normalizeHex(hexInput);
    if (valid !== null) {
      if (valid === '' && editingSlot === 'primary') {
        setHexInput(primaryColor);
        return;
      }
      setHexInput(valid || 'EMPTY');
      if (valid) setHsv(hexToHsv(valid));
      if (editingSlot === 'primary') onChangePrimary(valid);
      else onChangeSecondary(valid);
    } else {
      setHexInput(activeSlotRaw || 'EMPTY');
    }
  };

  const huePureHex = useMemo(() => hsvToHex(hsv.h, 100, 100), [hsv.h]);
  const primaryAlpha = getHexAlpha(primaryColor);
  const secondaryAlpha = getHexAlpha(secondaryColor);

  return (
    <div className="flex flex-col gap-4">
      {/* Active Primary & Secondary Color Pair */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">Active Colors</span>
          <button
            type="button"
            onClick={() =>
              onChangeSecondary(
                withHexAlpha(suggestDitherPartner(primaryColor), primaryAlpha)
              )
            }
            title="Pick a harmonious lighter or darker secondary tone for dithering"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span>Pair Shade</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Primary Slot */}
          <button
            type="button"
            onClick={() => setEditingSlot('primary')}
            className={`flex-1 flex items-center gap-2 p-2 rounded-lg border text-left transition-colors cursor-pointer ${
              editingSlot === 'primary'
                ? 'bg-[#222733] border-amber-400/70'
                : 'bg-[#171A22] border-[#2A2F3D] hover:border-slate-600'
            }`}
          >
            <span className="relative w-7 h-7 rounded-md border border-white/20 shrink-0 overflow-hidden checker-bg-sm">
              <span
                className="absolute inset-0"
                style={{ backgroundColor: primaryColor }}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-slate-400 leading-tight">Primary</span>
                {primaryAlpha < 100 && (
                  <span className="text-[10px] font-mono text-amber-300">{primaryAlpha}%</span>
                )}
              </div>
              <div className="text-xs font-mono text-slate-100 truncate">
                {stripHexAlpha(primaryColor)}
              </div>
            </div>
          </button>

          {/* Swap Button */}
          <button
            type="button"
            onClick={onSwapColors}
            title="Swap Primary & Secondary (X)"
            className="p-2 rounded-lg bg-[#171A22] border border-[#2A2F3D] text-slate-300 hover:text-white hover:border-slate-500 transition-colors shrink-0 cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          {/* Secondary Slot */}
          <button
            type="button"
            onClick={() => setEditingSlot('secondary')}
            className={`flex-1 flex items-center gap-2 p-2 rounded-lg border text-left transition-colors cursor-pointer ${
              editingSlot === 'secondary'
                ? 'bg-[#222733] border-amber-400/70'
                : 'bg-[#171A22] border-[#2A2F3D] hover:border-slate-600'
            }`}
          >
            <span className="relative w-7 h-7 rounded-md border border-white/20 shrink-0 overflow-hidden checker-bg-sm">
              {secondaryColor && (
                <span
                  className="absolute inset-0"
                  style={{ backgroundColor: secondaryColor }}
                />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-slate-400 leading-tight">Secondary</span>
                {secondaryColor && secondaryAlpha < 100 && (
                  <span className="text-[10px] font-mono text-sky-300">{secondaryAlpha}%</span>
                )}
              </div>
              <div className="text-xs font-mono text-slate-100 truncate">
                {secondaryColor ? stripHexAlpha(secondaryColor) : 'Empty'}
              </div>
            </div>
          </button>
        </div>

        {/* Toggle Transparent Secondary */}
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Dither alternates Primary & Secondary</span>
          <button
            type="button"
            onClick={() =>
              onChangeSecondary(secondaryColor ? '' : suggestDitherPartner(primaryColor))
            }
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              !secondaryColor
                ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                : 'bg-[#171A22] border-[#2A2F3D] text-slate-400 hover:text-slate-200'
            }`}
            title="Use transparent as Secondary color so dithering fades into empty pixels"
          >
            <Eraser className="w-3 h-3" />
            <span>{!secondaryColor ? 'Transparent On' : 'Set Empty'}</span>
          </button>
        </div>
      </div>

      {/* Simple Visual Color Picker (2D Tone Square + Hue Slider + Pixel Opacity) */}
      <div className="flex flex-col gap-2.5 pt-2 border-t border-[#262B38]">
        <div
          ref={svSquareRef}
          onPointerDown={(e) => {
            draggingSV.current = true;
            handleSVPointer(e.clientX, e.clientY);
          }}
          className="relative w-full h-36 rounded-lg overflow-hidden cursor-crosshair select-none border border-[#2A2F3D]"
          style={{ backgroundColor: huePureHex }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, #ffffff, rgba(255,255,255,0))' }}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, #000000, rgba(0,0,0,0))' }}
          />
          <div
            className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.8)] pointer-events-none"
            style={{
              left: `${hsv.s}%`,
              top: `${100 - hsv.v}%`,
            }}
          />
        </div>

        {/* Hue Rainbow Bar */}
        <div
          ref={hueBarRef}
          onPointerDown={(e) => {
            draggingHue.current = true;
            handleHuePointer(e.clientX);
          }}
          className="relative w-full h-4 rounded-md cursor-ew-resize select-none border border-[#2A2F3D]"
          style={{
            background:
              'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
          }}
        >
          <div
            className="absolute top-1/2 w-2.5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white border border-slate-900 shadow pointer-events-none"
            style={{ left: `${(hsv.h / 360) * 100}%` }}
          />
        </div>

        {/* Per-Pixel Opacity Control */}
        <div className="flex flex-col gap-1.5 bg-[#13161D] border border-[#242834] rounded-lg p-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">
              Pixel Opacity ({editingSlot === 'primary' ? 'Primary' : 'Secondary'})
            </span>
            <span className="font-mono text-amber-300">{activeOpacity}%</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={editingSlot === 'primary' ? 5 : 0}
              max={100}
              value={activeOpacity}
              onChange={(e) => handleOpacityChange(Number(e.target.value))}
              aria-label="Pixel opacity"
              className="flex-1 accent-amber-400 cursor-pointer"
            />
          </div>
          <div className="grid grid-cols-4 gap-1">
            {OPACITY_PRESETS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleOpacityChange(pct)}
                className={`py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                  activeOpacity === pct
                    ? 'bg-amber-400 border-amber-400 text-[#111318] font-semibold'
                    : 'bg-[#191D26] border-[#2A2F3D] text-slate-300 hover:border-slate-500'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Hex Input + Save Swatch */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-[#14171F] border border-[#2A2F3D] rounded-lg px-2.5 py-1.5 focus-within:border-amber-400/70">
            <span className="relative w-3.5 h-3.5 rounded-sm border border-white/15 mr-2 shrink-0 overflow-hidden checker-bg-sm">
              {activeSlotRaw && (
                <span
                  className="absolute inset-0"
                  style={{ backgroundColor: activeSlotRaw }}
                />
              )}
            </span>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value.toUpperCase())}
              onBlur={handleHexCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleHexCommit();
              }}
              aria-label="Hex color code"
              className="w-full bg-transparent text-xs font-mono text-slate-100 focus:outline-none"
              maxLength={9}
            />
          </div>
          <button
            type="button"
            disabled={!activeSlotRaw}
            onClick={() => {
              if (!activeSlotRaw) return;
              onAddCustomColor(stripHexAlpha(activeSlotRaw));
              onSelectPaletteId('custom');
            }}
            title="Save color to Saved Swatches"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1E2330] border border-[#2A2F3D] text-xs font-medium text-slate-200 hover:bg-[#272D3D] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Quick Hue-Shifted Shading Ramp */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-[#262B38]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">Quick Shading Ramp</span>
          <span className="text-[11px] text-slate-400">Shadow to Light</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {rampColors.map((hex, i) => (
            <button
              key={`${hex}-${i}`}
              type="button"
              onClick={() => applyColorToSlot(hex)}
              onContextMenu={(e) => {
                e.preventDefault();
                applyColorToSlot(hex, 'secondary');
              }}
              title={`${hex} — Click: set active · Right-click: set Secondary`}
              className={`h-7 rounded-md border transition-transform hover:scale-105 cursor-pointer ${
                hex === activeBaseHex ? 'border-white ring-1 ring-amber-400' : 'border-white/15'
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>

      {/* Curated Palettes */}
      <div className="flex flex-col gap-2 pt-2 border-t border-[#262B38]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300">Palette</span>
          <select
            value={activePaletteId}
            onChange={(e) => onSelectPaletteId(e.target.value)}
            aria-label="Select color palette"
            className="bg-[#14171F] border border-[#2A2F3D] rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400/70 cursor-pointer"
          >
            {CURATED_PALETTES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.colors.length})
              </option>
            ))}
            <option value="custom">Saved ({customColors.length})</option>
          </select>
        </div>

        <div className="grid grid-cols-8 gap-1.5">
          {activePalette.colors.map((hex) => {
            const isPrimary = hex === stripHexAlpha(primaryColor);
            const isSecondary = hex === stripHexAlpha(secondaryColor);
            return (
              <button
                key={hex}
                type="button"
                onClick={() => applyColorToSlot(hex)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  applyColorToSlot(hex, 'secondary');
                }}
                title={`${hex} · Click: Active · Right-click: Secondary`}
                className={`relative aspect-square rounded-md border transition-transform hover:scale-110 cursor-pointer ${
                  isPrimary
                    ? 'border-white ring-2 ring-amber-400 z-10'
                    : isSecondary
                    ? 'border-white ring-1 ring-sky-400 z-10'
                    : 'border-white/15'
                }`}
                style={{ backgroundColor: hex }}
              >
                {isPrimary && (
                  <span className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-amber-400 border border-[#111318]" />
                )}
                {isSecondary && !isPrimary && (
                  <span className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-sky-400 border border-[#111318]" />
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400">
          Left-click sets active color · Right-click sets Secondary
        </p>
      </div>
    </div>
  );
};
