import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Eye,
  EyeOff,
  Layers2,
  Plus,
  Trash2,
} from 'lucide-react';
import { PixelLayer } from '../types/pixel';

interface LayerThumbnailProps {
  grid: string[];
  width: number;
  height: number;
  opacity: number;
}

const LayerThumbnail: React.FC<LayerThumbnailProps> = ({
  grid,
  width,
  height,
  opacity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.globalAlpha = opacity / 100;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = grid[y * width + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.restore();
  }, [grid, width, height, opacity]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-7 h-7 rounded-sm pixelated checker-bg-sm border border-white/15 shrink-0"
    />
  );
};

interface LayerPanelProps {
  layers: PixelLayer[]; // bottom-to-top
  activeLayerId: string;
  width: number;
  height: number;
  onSelectLayer: (id: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onMergeDown: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
  onChangeOpacity: (id: string, opacity: number) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  activeLayerId,
  width,
  height,
  onSelectLayer,
  onAddLayer,
  onDeleteLayer,
  onToggleVisibility,
  onMoveLayer,
  onMergeDown,
  onDuplicateLayer,
  onRenameLayer,
  onChangeOpacity,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const activeIndex = layers.findIndex((l) => l.id === activeLayerId);
  const activeLayer = layers[activeIndex] ?? layers[0];

  // Display top-to-bottom so upper layers appear above lower layers
  const reversedLayers = [...layers].reverse();

  const commitRename = (id: string) => {
    const trimmed = draftName.trim();
    if (trimmed) {
      onRenameLayer(id, trimmed);
    }
    setEditingId(null);
  };

  return (
    <aside className="w-[216px] shrink-0 border-r border-[#242834] bg-[#161920] flex flex-col min-h-0">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#242834] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200">Layers</span>
          <span className="text-[11px] font-mono text-slate-400">{layers.length}</span>
        </div>
        <button
          type="button"
          onClick={onAddLayer}
          title="Add New Layer"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-[#1E2330] border border-[#2A2F3D] text-slate-200 hover:bg-[#272D3D] hover:border-slate-500 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-amber-300" />
          <span>Add</span>
        </button>
      </div>

      {/* Layer Stack List */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {reversedLayers.map((layer) => {
          const isActive = layer.id === activeLayerId;
          const isEditing = editingId === layer.id;

          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              className={`group flex items-center gap-2 p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#222733] border-amber-400/75'
                  : 'bg-[#13161D] border-[#222632] hover:border-[#343B4D]'
              }`}
            >
              <LayerThumbnail
                grid={layer.grid}
                width={width}
                height={height}
                opacity={layer.opacity}
              />

              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <input
                    type="text"
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => commitRename(layer.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(layer.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    maxLength={18}
                    className="w-full bg-[#101217] border border-amber-400/70 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                  />
                ) : (
                  <div
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingId(layer.id);
                      setDraftName(layer.name);
                    }}
                    title="Double-click to rename layer"
                    className={`text-xs font-medium truncate ${
                      layer.visible ? 'text-slate-100' : 'text-slate-500 line-through'
                    }`}
                  >
                    {layer.name}
                  </div>
                )}
                <div className="text-[10px] font-mono text-slate-400">
                  {layer.opacity}%
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(layer.id);
                }}
                title={layer.visible ? 'Hide layer' : 'Show layer'}
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                className={`p-1 rounded transition-colors shrink-0 cursor-pointer ${
                  layer.visible
                    ? 'text-slate-300 hover:text-white hover:bg-[#2C3344]'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-[#232836]'
                }`}
              >
                {layer.visible ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Active Layer Controls Footer */}
      {activeLayer && (
        <div className="p-3 border-t border-[#242834] bg-[#13161D] flex flex-col gap-2.5 shrink-0">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium truncate">
                {activeLayer.name} Opacity
              </span>
              <span className="font-mono text-slate-200">{activeLayer.opacity}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={activeLayer.opacity}
              onChange={(e) => onChangeOpacity(activeLayer.id, Number(e.target.value))}
              aria-label="Active layer opacity"
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-5 gap-1">
            <button
              type="button"
              onClick={() => onMoveLayer(activeLayer.id, 'up')}
              disabled={activeIndex >= layers.length - 1}
              title="Move Layer Up"
              className="p-1.5 rounded bg-[#1B1F29] border border-[#2A2F3D] text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMoveLayer(activeLayer.id, 'down')}
              disabled={activeIndex <= 0}
              title="Move Layer Down"
              className="p-1.5 rounded bg-[#1B1F29] border border-[#2A2F3D] text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDuplicateLayer(activeLayer.id)}
              title="Duplicate Layer"
              className="p-1.5 rounded bg-[#1B1F29] border border-[#2A2F3D] text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <CopyPlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMergeDown(activeLayer.id)}
              disabled={activeIndex <= 0}
              title="Merge Down"
              className="p-1.5 rounded bg-[#1B1F29] border border-[#2A2F3D] text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
            >
              <Layers2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteLayer(activeLayer.id)}
              disabled={layers.length <= 1}
              title="Delete Layer"
              className="p-1.5 rounded bg-[#1B1F29] border border-[#2A2F3D] text-slate-300 hover:text-rose-300 hover:border-rose-500/50 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
