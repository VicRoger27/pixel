import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Blend,
  Circle,
  Crosshair,
  Dices,
  Download,
  Eraser,
  FlipHorizontal2,
  Grid3X3,
  ImagePlus,
  Maximize2,
  Minus,
  PaintBucket,
  Pencil,
  Pipette,
  Plus,
  Redo2,
  Slash,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Wand2,
} from 'lucide-react';
import { ColorStudio } from './components/ColorStudio';
import { DitherControls } from './components/DitherControls';
import { ExportModal } from './components/ExportModal';
import { ImportDitherModal } from './components/ImportDitherModal';
import { LayerPanel } from './components/LayerPanel';
import { PixelCanvas } from './components/PixelCanvas';
import {
  CanvasBackdrop,
  CanvasSnapshot,
  DitherPattern,
  FillStyle,
  GradientDitherMode,
  NoiseMode,
  PixelLayer,
  Point,
  SymmetryBrushStyle,
  SymmetryGuideMode,
  ToolId,
} from './types/pixel';
import { compositeHexOver, getHexAlpha } from './utils/color';
import { BAYER_4X4, evalDitherPattern } from './utils/dither';

const GRID_SIZES = [16, 32, 48, 64] as const;

interface ToolDef {
  id: ToolId;
  label: string;
  shortcut: string;
  icon: React.FC<{ className?: string }>;
}

const TOOLS: ToolDef[] = [
  { id: 'pencil', label: 'Pencil', shortcut: 'B', icon: Pencil },
  { id: 'dither', label: 'Dither Brush', shortcut: 'D', icon: Sparkles },
  { id: 'noise', label: 'Noise Brush', shortcut: 'N', icon: Dices },
  { id: 'symmetry', label: 'Symmetry Brush', shortcut: 'M', icon: FlipHorizontal2 },
  { id: 'gradient', label: 'Dither Gradient', shortcut: 'G', icon: Blend },
  { id: 'bucket', label: 'Bucket Fill', shortcut: 'F', icon: PaintBucket },
  { id: 'line', label: 'Line', shortcut: 'L', icon: Slash },
  { id: 'rect', label: 'Rectangle', shortcut: 'R', icon: Square },
  { id: 'circle', label: 'Circle', shortcut: 'C', icon: Circle },
  { id: 'eyedropper', label: 'Eyedropper', shortcut: 'I', icon: Pipette },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
];

function createEmptyGrid(w: number, h: number): string[] {
  return new Array<string>(w * h).fill('');
}

let layerUidCounter = 1;
function createLayer(name: string, w: number, h: number, grid?: string[]): PixelLayer {
  return {
    id: `layer-${layerUidCounter++}`,
    name,
    grid: grid ?? createEmptyGrid(w, h),
    visible: true,
    opacity: 100,
  };
}

function getNextLayerName(layers: PixelLayer[]): string {
  let maxNum = 0;
  for (const l of layers) {
    const match = /^L(\d+)$/i.exec(l.name.trim());
    if (match) {
      maxNum = Math.max(maxNum, Number(match[1]));
    }
  }
  return `L${Math.max(maxNum + 1, layers.length + 1)}`;
}

/**
 * Generates a 3-layer dithered sunset & planet pixel scene (L1 Sky, L2 Sun, L3 Hills).
 */
function createSampleDitherLayers(w: number, h: number): PixelLayer[] {
  const skyGrid = createEmptyGrid(w, h);
  const sunGrid = createEmptyGrid(w, h);
  const hillsGrid = createEmptyGrid(w, h);

  const skyColors = ['#1D2B53', '#7E2553', '#AB5236', '#FFA300', '#FFEC27'];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = (y / Math.max(1, h - 1)) * (skyColors.length - 1);
      const idx = Math.min(skyColors.length - 2, Math.floor(t));
      const frac = t - idx;
      const bayer = (BAYER_4X4[y % 4][x % 4] + 0.5) / 16;
      skyGrid[y * w + x] = frac < bayer ? skyColors[idx] : skyColors[idx + 1];
    }
  }

  const cx = w * 0.5;
  const cy = h * 0.44;
  const r = Math.max(4, Math.floor(w * 0.24));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        const shade = (dx * 0.65 + dy * 0.75) / (r * 1.4) + 0.45;
        const bayer = (BAYER_4X4[y % 4][x % 4] + 0.5) / 16;
        if (shade < 0.28) {
          sunGrid[y * w + x] = shade / 0.28 < bayer ? '#FFF1E8' : '#FFEC27';
        } else if (shade < 0.62) {
          sunGrid[y * w + x] = (shade - 0.28) / 0.34 < bayer ? '#FFEC27' : '#FFA300';
        } else {
          sunGrid[y * w + x] = (shade - 0.62) / 0.38 < bayer ? '#FFA300' : '#FF004D';
        }
      }
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hillY = h * 0.74 + Math.sin((x / w) * Math.PI * 2.3) * (h * 0.06);
      if (y >= hillY) {
        const depth = (y - hillY) / Math.max(1, h * 0.25);
        hillsGrid[y * w + x] =
          depth < 0.35 && evalDitherPattern(x, y, 'checker50') ? '#1D2B53' : '#000000';
      }
    }
  }

  return [
    createLayer('L1', w, h, skyGrid),
    createLayer('L2', w, h, sunGrid),
    createLayer('L3', w, h, hillsGrid),
  ];
}

export default function App() {
  const [gridSize, setGridSize] = useState<number>(32);
  const initialLayer = useMemo(() => createLayer('L1', 32, 32), []);
  const [layers, setLayers] = useState<PixelLayer[]>(() => [initialLayer]);
  const [activeLayerId, setActiveLayerId] = useState<string>(() => initialLayer.id);
  const [history, setHistory] = useState<CanvasSnapshot[]>(() => [
    { layers: [initialLayer], activeLayerId: initialLayer.id },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const [activeTool, setActiveTool] = useState<ToolId>('dither');
  const [primaryColor, setPrimaryColor] = useState<string>('#FF004D');
  const [secondaryColor, setSecondaryColor] = useState<string>('#FFA300');
  const [ditherPattern, setDitherPattern] = useState<DitherPattern>('checker50');
  const [gradientMode, setGradientMode] = useState<GradientDitherMode>('bayer4');
  const [fillStyle, setFillStyle] = useState<FillStyle>('solid');
  const [symmetryBrushStyle, setSymmetryBrushStyle] = useState<SymmetryBrushStyle>('solid');
  const [noiseMode, setNoiseMode] = useState<NoiseMode>('shade');
  const [noiseStrength, setNoiseStrength] = useState<number>(35);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [mirrorX, setMirrorX] = useState<boolean>(false);
  const [mirrorY, setMirrorY] = useState<boolean>(false);
  const [mirrorFollowsGuides, setMirrorFollowsGuides] = useState<boolean>(false);
  const [guideMode, setGuideMode] = useState<SymmetryGuideMode>('off');

  const [activePaletteId, setActivePaletteId] = useState<string>('pico8');
  const [customColors, setCustomColors] = useState<string[]>([
    '#14141C', '#3A3E52', '#7E86A3', '#F4F1EA', '#FF6B4A', '#FFC857', '#2EC4B6', '#3A86FF',
  ]);

  const [zoom, setZoom] = useState<number>(16);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [backdrop, setBackdrop] = useState<CanvasBackdrop>('checker');
  const [hoverPixel, setHoverPixel] = useState<Point | null>(null);

  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewportWrapRef = useRef<HTMLDivElement>(null);

  const commitSnapshot = useCallback(
    (nextLayers: PixelLayer[], nextActiveId: string = activeLayerId) => {
      setLayers(nextLayers);
      setActiveLayerId(nextActiveId);
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        const updated = [...sliced, { layers: nextLayers, activeLayerId: nextActiveId }];
        if (updated.length > 50) updated.shift();
        setHistoryIndex(updated.length - 1);
        return updated;
      });
    },
    [activeLayerId, historyIndex]
  );

  const commitActiveGrid = useCallback(
    (nextGrid: string[]) => {
      const nextLayers = layers.map((l) =>
        l.id === activeLayerId ? { ...l, grid: nextGrid } : l
      );
      commitSnapshot(nextLayers, activeLayerId);
    },
    [layers, activeLayerId, commitSnapshot]
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const nextIdx = historyIndex - 1;
    const snap = history[nextIdx];
    setHistoryIndex(nextIdx);
    setLayers(snap.layers);
    setActiveLayerId(snap.activeLayerId);
  }, [canUndo, historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const nextIdx = historyIndex + 1;
    const snap = history[nextIdx];
    setHistoryIndex(nextIdx);
    setLayers(snap.layers);
    setActiveLayerId(snap.activeLayerId);
  }, [canRedo, historyIndex, history]);

  const handleFitZoom = useCallback(
    (size = gridSize) => {
      const wrap = viewportWrapRef.current;
      if (!wrap) return;
      const availW = Math.max(240, wrap.clientWidth - 96);
      const availH = Math.max(240, wrap.clientHeight - 120);
      const fit = Math.floor(Math.min(availW / size, availH / size));
      setZoom(Math.max(4, Math.min(32, fit)));
    },
    [gridSize]
  );

  useEffect(() => {
    handleFitZoom(gridSize);
  }, [gridSize, handleFitZoom]);

  const handleResizeGrid = (nextSize: number) => {
    if (nextSize === gridSize) return;
    const copyW = Math.min(gridSize, nextSize);
    const copyH = Math.min(gridSize, nextSize);
    const nextLayers = layers.map((layer) => {
      const nextGrid = createEmptyGrid(nextSize, nextSize);
      for (let y = 0; y < copyH; y++) {
        for (let x = 0; x < copyW; x++) {
          nextGrid[y * nextSize + x] = layer.grid[y * gridSize + x];
        }
      }
      return { ...layer, grid: nextGrid };
    });
    setGridSize(nextSize);
    setLayers(nextLayers);
    setHistory([{ layers: nextLayers, activeLayerId }]);
    setHistoryIndex(0);
  };

  // Layer actions
  const handleAddLayer = () => {
    const newLayer = createLayer(getNextLayerName(layers), gridSize, gridSize);
    const activeIdx = layers.findIndex((l) => l.id === activeLayerId);
    const insertAt = activeIdx >= 0 ? activeIdx + 1 : layers.length;
    const nextLayers = [
      ...layers.slice(0, insertAt),
      newLayer,
      ...layers.slice(insertAt),
    ];
    commitSnapshot(nextLayers, newLayer.id);
  };

  const handleDeleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    const idx = layers.findIndex((l) => l.id === id);
    const nextLayers = layers.filter((l) => l.id !== id);
    const nextActive =
      id === activeLayerId
        ? nextLayers[Math.max(0, idx - 1)].id
        : activeLayerId;
    commitSnapshot(nextLayers, nextActive);
  };

  const handleToggleLayerVisibility = (id: string) => {
    const nextLayers = layers.map((l) =>
      l.id === id ? { ...l, visible: !l.visible } : l
    );
    commitSnapshot(nextLayers, activeLayerId);
  };

  const handleMoveLayer = (id: string, direction: 'up' | 'down') => {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (targetIdx < 0 || targetIdx >= layers.length) return;
    const nextLayers = [...layers];
    const [moved] = nextLayers.splice(idx, 1);
    nextLayers.splice(targetIdx, 0, moved);
    commitSnapshot(nextLayers, activeLayerId);
  };

  const handleDuplicateLayer = (id: string) => {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const src = layers[idx];
    const dup: PixelLayer = {
      ...createLayer(getNextLayerName(layers), gridSize, gridSize, [...src.grid]),
      visible: src.visible,
      opacity: src.opacity,
    };
    const nextLayers = [
      ...layers.slice(0, idx + 1),
      dup,
      ...layers.slice(idx + 1),
    ];
    commitSnapshot(nextLayers, dup.id);
  };

  const handleMergeDown = (id: string) => {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    const upper = layers[idx];
    const lower = layers[idx - 1];
    const mergedGrid = [...lower.grid];
    for (let i = 0; i < mergedGrid.length; i++) {
      if (upper.grid[i]) {
        mergedGrid[i] = compositeHexOver(mergedGrid[i], upper.grid[i], upper.opacity);
      }
    }
    const mergedLayer: PixelLayer = { ...lower, grid: mergedGrid };
    const nextLayers = layers
      .map((l, i) => (i === idx - 1 ? mergedLayer : l))
      .filter((_, i) => i !== idx);
    commitSnapshot(nextLayers, mergedLayer.id);
  };

  const handleRenameLayer = (id: string, name: string) => {
    const nextLayers = layers.map((l) => (l.id === id ? { ...l, name } : l));
    commitSnapshot(nextLayers, activeLayerId);
  };

  const handleChangeLayerOpacity = (id: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity } : l))
    );
  };

  const handleSwapColors = useCallback(() => {
    if (!secondaryColor) return;
    setPrimaryColor(secondaryColor);
    setSecondaryColor(primaryColor);
  }, [primaryColor, secondaryColor]);

  const selectTool = useCallback((id: ToolId) => {
    setActiveTool(id);
    if (id === 'symmetry') {
      setGuideMode((g) => (g === 'off' ? 'vertical' : g));
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'x') {
        handleSwapColors();
        return;
      }
      if (key === 's') {
        setGuideMode((prev) => {
          const order: SymmetryGuideMode[] = ['off', 'vertical', 'horizontal', 'both'];
          return order[(order.indexOf(prev) + 1) % order.length];
        });
        return;
      }
      if (key === '[') {
        const sizes = [1, 2, 3, 5];
        setBrushSize((s) => sizes[Math.max(0, sizes.indexOf(s) - 1)] ?? 1);
        return;
      }
      if (key === ']') {
        const sizes = [1, 2, 3, 5];
        setBrushSize((s) => sizes[Math.min(sizes.length - 1, sizes.indexOf(s) + 1)] ?? 5);
        return;
      }

      const matched = TOOLS.find((t) => t.shortcut.toLowerCase() === key);
      if (matched) {
        selectTool(matched.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, handleSwapColors, selectTool]);

  const guideMirrorX = guideMode === 'vertical' || guideMode === 'both';
  const guideMirrorY = guideMode === 'horizontal' || guideMode === 'both';
  const useGuideMirror = activeTool === 'symmetry' || mirrorFollowsGuides;
  const effectiveMirrorX = useGuideMirror ? guideMirrorX : mirrorX;
  const effectiveMirrorY = useGuideMirror ? guideMirrorY : mirrorY;

  const handleToggleMirrorX = useCallback(() => {
    setMirrorX((prev) => {
      const next = !prev;
      setGuideMode((g) => {
        if (next) {
          if (g === 'off') return 'vertical';
          if (g === 'horizontal') return 'both';
          return g;
        } else {
          if (g === 'vertical') return 'off';
          if (g === 'both') return 'horizontal';
          return g;
        }
      });
      return next;
    });
  }, []);

  const handleToggleMirrorY = useCallback(() => {
    setMirrorY((prev) => {
      const next = !prev;
      setGuideMode((g) => {
        if (next) {
          if (g === 'off') return 'horizontal';
          if (g === 'vertical') return 'both';
          return g;
        } else {
          if (g === 'horizontal') return 'off';
          if (g === 'both') return 'vertical';
          return g;
        }
      });
      return next;
    });
  }, []);

  // Render composited 1:1 mini live preview across visible layers
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, gridSize, gridSize);
    for (const layer of layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const c = layer.grid[y * gridSize + x];
          if (!c) continue;
          ctx.fillStyle = c;
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.restore();
    }
  }, [layers, gridSize]);

  const activeToolMeta = useMemo(
    () => TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0],
    [activeTool]
  );

  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId) ?? layers[0],
    [layers, activeLayerId]
  );

  const isActiveLayerEmpty = useMemo(
    () => (activeLayer ? activeLayer.grid.every((c) => c === '') : true),
    [activeLayer]
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-[#111318] text-[#F1F3F5] overflow-hidden">
      {/* Top Studio Header */}
      <header className="h-13 shrink-0 px-4 border-b border-[#242834] bg-[#161920] flex items-center justify-between gap-6">
        <div className="flex items-center gap-5 shrink-0">
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            PixelDraft
          </span>

          <div className="h-4 w-px bg-[#2A2F3D]" aria-hidden="true" />

          {/* Canvas Size Selector */}
          <div className="flex items-center gap-1 bg-[#101217] p-0.5 rounded-lg border border-[#242834]">
            {GRID_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleResizeGrid(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  gridSize === s
                    ? 'bg-[#252A36] text-amber-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}×{s}
              </button>
            ))}
          </div>
        </div>

        {/* Center Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 mr-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#222733] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#222733] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const sample = createSampleDitherLayers(gridSize, gridSize);
              commitSnapshot(sample, sample[sample.length - 1].id);
            }}
            title="Load a 3-layer (L1, L2, L3) dithered sample scene"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1D212B] border border-[#2A2F3D] text-slate-200 hover:border-slate-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-300" />
            <span>Sample Scene</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1D212B] border border-[#2A2F3D] text-slate-200 hover:border-slate-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ImagePlus className="w-3.5 h-3.5 text-sky-300" />
            <span>Import & Dither</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isActiveLayerEmpty) {
                commitActiveGrid(createEmptyGrid(gridSize, gridSize));
              }
            }}
            disabled={isActiveLayerEmpty}
            title={`Clear ${activeLayer?.name ?? 'Active Layer'}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1D212B] border border-[#2A2F3D] text-slate-300 hover:text-rose-300 hover:border-rose-500/40 disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        {/* Primary Export CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 text-[#111318] hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PNG</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Vertical Tool Dock */}
        <aside className="w-15 shrink-0 border-r border-[#242834] bg-[#161920] py-3 px-2 flex flex-col items-center gap-1.5 overflow-y-auto">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => selectTool(tool.id)}
                title={`${tool.label} (${tool.shortcut})`}
                aria-label={tool.label}
                className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-400 text-[#111318] shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#222733]'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span
                  className={`absolute bottom-0.5 right-1 text-[9px] font-mono leading-none ${
                    active ? 'text-[#111318]/75 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {tool.shortcut}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Layers Panel (L1, L2, L3...) */}
        <LayerPanel
          layers={layers}
          activeLayerId={activeLayerId}
          width={gridSize}
          height={gridSize}
          onSelectLayer={setActiveLayerId}
          onAddLayer={handleAddLayer}
          onDeleteLayer={handleDeleteLayer}
          onToggleVisibility={handleToggleLayerVisibility}
          onMoveLayer={handleMoveLayer}
          onMergeDown={handleMergeDown}
          onDuplicateLayer={handleDuplicateLayer}
          onRenameLayer={handleRenameLayer}
          onChangeOpacity={handleChangeLayerOpacity}
        />

        {/* Center Canvas Viewport */}
        <main ref={viewportWrapRef} className="relative flex-1 min-w-0 min-h-0 flex flex-col">
          <PixelCanvas
            layers={layers}
            activeLayerId={activeLayerId}
            width={gridSize}
            height={gridSize}
            activeTool={activeTool}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            ditherPattern={ditherPattern}
            gradientMode={gradientMode}
            fillStyle={fillStyle}
            symmetryBrushStyle={symmetryBrushStyle}
            noiseMode={noiseMode}
            noiseStrength={noiseStrength}
            brushSize={brushSize}
            mirrorX={effectiveMirrorX}
            mirrorY={effectiveMirrorY}
            guideMode={guideMode}
            zoom={zoom}
            onChangeZoom={setZoom}
            showGrid={showGrid}
            backdrop={backdrop}
            onCommitGrid={commitActiveGrid}
            onPickColor={(hex, asSecondary) => {
              if (asSecondary) setSecondaryColor(hex);
              else setPrimaryColor(hex);
            }}
            onHoverPixel={setHoverPixel}
          />

          {/* Bottom-Left Active Tool, Layer & Coordinates Readout */}
          <div className="pointer-events-none absolute bottom-3.5 left-4 flex items-center gap-2.5 text-xs text-slate-400 bg-[#161920]/90 border border-[#262B38] rounded-lg px-3 py-1.5 backdrop-blur-sm">
            <span className="font-medium text-slate-200">
              {activeToolMeta.label}
              {(effectiveMirrorX || effectiveMirrorY) && (
                <span className="text-amber-300 font-mono ml-1">
                  ({effectiveMirrorX && effectiveMirrorY ? 'V+H' : effectiveMirrorX ? 'V' : 'H'})
                </span>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-300">
              {activeLayer?.name ?? 'L1'}
              {activeLayer && !activeLayer.visible ? ' (hidden)' : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-300">
              {hoverPixel ? `${hoverPixel.x}, ${hoverPixel.y}` : `— , —`}
            </span>
            {hoverPixel && activeLayer && activeLayer.grid[hoverPixel.y * gridSize + hoverPixel.x] && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-sky-300">
                  {getHexAlpha(activeLayer.grid[hoverPixel.y * gridSize + hoverPixel.x])}%
                </span>
              </>
            )}
          </div>

          {/* Bottom-Center Zoom & View Controls */}
          <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#161920]/95 border border-[#262B38] rounded-lg px-2 py-1 shadow-lg backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(4, z - 2))}
              title="Zoom Out"
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-[#232836] transition-colors cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-11 text-center text-xs font-mono text-slate-200">
              {zoom}px
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(36, z + 2))}
              title="Zoom In"
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-[#232836] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleFitZoom(gridSize)}
              title="Fit to Viewport"
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-[#232836] transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-[#2A2F3D] mx-0.5" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setShowGrid((g) => !g)}
              title="Toggle Pixel Grid"
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                showGrid
                  ? 'bg-[#252A36] text-amber-300'
                  : 'text-slate-400 hover:text-white hover:bg-[#232836]'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-[#2A2F3D] mx-0.5" aria-hidden="true" />

            {/* Symmetry Guide Overlay Selector */}
            <div
              className="flex items-center gap-0.5 bg-[#101217] rounded p-0.5 border border-[#242834]"
              title="Symmetry Guide Lines (S)"
            >
              <span className="px-1.5 text-slate-400 flex items-center" title="Symmetry Guides (S)">
                <Crosshair className="w-3 h-3" />
              </span>
              {(
                [
                  { id: 'off', label: 'Off', title: 'Hide symmetry guides' },
                  { id: 'vertical', label: 'V', title: 'Vertical symmetry line' },
                  { id: 'horizontal', label: 'H', title: 'Horizontal symmetry line' },
                  { id: 'both', label: 'Both', title: 'Vertical & horizontal symmetry lines' },
                ] as { id: SymmetryGuideMode; label: string; title: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setGuideMode(opt.id)}
                  title={opt.title}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    guideMode === opt.id
                      ? opt.id === 'off'
                        ? 'bg-[#252A36] text-slate-100 font-medium'
                        : 'bg-sky-500/20 text-sky-300 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-0.5 bg-[#101217] rounded p-0.5 border border-[#242834]">
              {(['checker', 'dark', 'light'] as CanvasBackdrop[]).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBackdrop(b)}
                  title={`${b.charAt(0).toUpperCase() + b.slice(1)} canvas backdrop`}
                  className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors cursor-pointer ${
                    backdrop === b
                      ? 'bg-[#252A36] text-slate-100 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </main>

        {/* Right Color & Dithering Studio */}
        <aside className="w-[324px] shrink-0 border-l border-[#242834] bg-[#161920] flex flex-col min-h-0">
          {/* Live 1:1 & 2x Preview Header */}
          <div className="px-4 py-3 border-b border-[#242834] flex items-center justify-between gap-3 shrink-0 bg-[#13161D]">
            <div>
              <div className="text-xs font-semibold text-slate-200">Actual Size Preview</div>
              <div className="text-[11px] font-mono text-slate-400">
                {gridSize}×{gridSize} · Right-click paints Secondary
              </div>
            </div>
            <div className="p-1 rounded-md border border-[#2A2F3D] checker-bg-sm shrink-0">
              <canvas
                ref={previewCanvasRef}
                width={gridSize}
                height={gridSize}
                className="w-12 h-12 pixelated block"
              />
            </div>
          </div>

          {/* Scrollable Color & Dither Controls */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <ColorStudio
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              onChangePrimary={setPrimaryColor}
              onChangeSecondary={setSecondaryColor}
              onSwapColors={handleSwapColors}
              activePaletteId={activePaletteId}
              onSelectPaletteId={setActivePaletteId}
              customColors={customColors}
              onAddCustomColor={(hex) => {
                setCustomColors((prev) =>
                  prev.includes(hex) ? prev : [hex, ...prev].slice(0, 32)
                );
              }}
            />

            <DitherControls
              activeTool={activeTool}
              ditherPattern={ditherPattern}
              onSelectPattern={setDitherPattern}
              gradientMode={gradientMode}
              onSelectGradientMode={setGradientMode}
              fillStyle={fillStyle}
              onChangeFillStyle={setFillStyle}
              symmetryBrushStyle={symmetryBrushStyle}
              onChangeSymmetryBrushStyle={setSymmetryBrushStyle}
              guideMode={guideMode}
              onChangeGuideMode={setGuideMode}
              mirrorFollowsGuides={mirrorFollowsGuides}
              onToggleMirrorFollowsGuides={() => {
                setMirrorFollowsGuides((v) => {
                  const next = !v;
                  if (next && guideMode === 'off') setGuideMode('vertical');
                  return next;
                });
              }}
              noiseMode={noiseMode}
              onChangeNoiseMode={setNoiseMode}
              noiseStrength={noiseStrength}
              onChangeNoiseStrength={setNoiseStrength}
              brushSize={brushSize}
              onChangeBrushSize={setBrushSize}
              mirrorX={effectiveMirrorX}
              mirrorY={effectiveMirrorY}
              onToggleMirrorX={handleToggleMirrorX}
              onToggleMirrorY={handleToggleMirrorY}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
            />
          </div>
        </aside>
      </div>

      {/* Modals */}
      <ImportDitherModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        gridWidth={gridSize}
        gridHeight={gridSize}
        activePaletteId={activePaletteId}
        customColors={customColors}
        onApplyGrid={commitActiveGrid}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        layers={layers}
        width={gridSize}
        height={gridSize}
      />
    </div>
  );
}
