import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CanvasBackdrop,
  DitherPattern,
  FillStyle,
  GradientDitherMode,
  NoiseMode,
  PixelLayer,
  Point,
  SymmetryBrushStyle,
  SymmetryGuideMode,
  ToolId,
} from '../types/pixel';
import { generateNoiseColor, spatialNoiseRand } from '../utils/color';
import {
  applySymmetry,
  evalDitherPattern,
  expandBrushPoints,
  floodFillGrid,
  getBresenhamLine,
  getEllipsePoints,
  getRectPoints,
  renderDitherGradient,
} from '../utils/dither';

interface PixelCanvasProps {
  layers: PixelLayer[];
  activeLayerId: string;
  width: number;
  height: number;
  activeTool: ToolId;
  primaryColor: string;
  secondaryColor: string;
  ditherPattern: DitherPattern;
  gradientMode: GradientDitherMode;
  fillStyle: FillStyle;
  symmetryBrushStyle: SymmetryBrushStyle;
  noiseMode: NoiseMode;
  noiseStrength: number;
  brushSize: number;
  mirrorX: boolean;
  mirrorY: boolean;
  guideMode: SymmetryGuideMode;
  zoom: number;
  onChangeZoom: (next: number) => void;
  showGrid: boolean;
  backdrop: CanvasBackdrop;
  onCommitGrid: (nextGrid: string[]) => void;
  onPickColor: (hex: string, asSecondary: boolean) => void;
  onHoverPixel: (pt: Point | null) => void;
}

export const PixelCanvas: React.FC<PixelCanvasProps> = ({
  layers,
  activeLayerId,
  width,
  height,
  activeTool,
  primaryColor,
  secondaryColor,
  ditherPattern,
  gradientMode,
  fillStyle,
  symmetryBrushStyle,
  noiseMode,
  noiseStrength,
  brushSize,
  mirrorX,
  mirrorY,
  guideMode,
  zoom,
  onChangeZoom,
  showGrid,
  backdrop,
  onCommitGrid,
  onPickColor,
  onHoverPixel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [hoverPt, setHoverPt] = useState<Point | null>(null);

  // Active stroke / shape state
  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number }>({
    clientX: 0,
    clientY: 0,
    panX: 0,
    panY: 0,
  });
  const strokeButtonRef = useRef<number>(0); // 0 left, 2 right
  const lastPtRef = useRef<Point | null>(null);
  const shapeStartRef = useRef<Point | null>(null);
  const strokeVisitedRef = useRef<Set<number>>(new Set());
  const shapeSeedRef = useRef<number>(1);
  const [shapeCurrent, setShapeCurrent] = useState<Point | null>(null);
  const [draftGrid, setDraftGrid] = useState<string[] | null>(null);

  // Reset pan when grid size changes
  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [width, height]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId) ?? layers[0],
    [layers, activeLayerId]
  );
  const grid = activeLayer?.grid ?? [];

  const displayPxSize = useMemo(() => Math.round(zoom), [zoom]);
  const canvasPixelW = width * displayPxSize;
  const canvasPixelH = height * displayPxSize;

  // Compute live preview pixels for shape/gradient/hover on active layer
  const previewGrid = useMemo(() => {
    if (draftGrid) return draftGrid;
    if (!shapeStartRef.current || !shapeCurrent) return null;

    const start = shapeStartRef.current;
    const end = shapeCurrent;

    if (activeTool === 'gradient') {
      return renderDitherGradient(
        grid,
        width,
        height,
        start,
        end,
        primaryColor,
        secondaryColor,
        gradientMode
      );
    }

    const isFilledShape = fillStyle !== 'solid';
    let pts: Point[] = [];
    if (activeTool === 'line') {
      pts = getBresenhamLine(start.x, start.y, end.x, end.y);
    } else if (activeTool === 'rect') {
      pts = getRectPoints(start.x, start.y, end.x, end.y, isFilledShape);
    } else if (activeTool === 'circle') {
      pts = getEllipsePoints(start.x, start.y, end.x, end.y, isFilledShape);
    }

    if (pts.length === 0) return null;
    const symPts = applySymmetry(pts, width, height, mirrorX, mirrorY);
    const next = [...grid];
    const seed = shapeSeedRef.current;
    for (const p of symPts) {
      let color = primaryColor;
      if (fillStyle === 'dither') {
        color = evalDitherPattern(p.x, p.y, ditherPattern) ? primaryColor : secondaryColor;
      } else if (fillStyle === 'noise') {
        let step = 0;
        color = generateNoiseColor(
          primaryColor,
          secondaryColor,
          noiseMode,
          noiseStrength,
          () => spatialNoiseRand(p.x * 11 + step++, p.y * 19 + seed, seed)
        );
      }
      next[p.y * width + p.x] = color;
    }
    return next;
  }, [
    draftGrid,
    shapeCurrent,
    activeTool,
    grid,
    width,
    height,
    primaryColor,
    secondaryColor,
    gradientMode,
    fillStyle,
    noiseMode,
    noiseStrength,
    ditherPattern,
    mirrorX,
    mirrorY,
  ]);

  const activeGridToRender = previewGrid ?? grid;

  // Draw pixels + overlays on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasPixelW, canvasPixelH);

    // Draw visible layers bottom-to-top with opacity
    for (const layer of layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      const layerGrid =
        layer.id === activeLayerId && previewGrid ? previewGrid : layer.grid;
      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const color = layerGrid[y * width + x];
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect(x * displayPxSize, y * displayPxSize, displayPxSize, displayPxSize);
        }
      }
      ctx.restore();
    }

    // Draw pixel grid lines
    if (showGrid && displayPxSize >= 6) {
      ctx.strokeStyle =
        backdrop === 'light' ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < width; x++) {
        const px = x * displayPxSize + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, canvasPixelH);
      }
      for (let y = 1; y < height; y++) {
        const py = y * displayPxSize + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(canvasPixelW, py);
      }
      ctx.stroke();
    }

    // Draw visual symmetry guide overlay (vertical, horizontal, or both)
    const showVerticalGuide = guideMode === 'vertical' || guideMode === 'both';
    const showHorizontalGuide = guideMode === 'horizontal' || guideMode === 'both';

    if (showVerticalGuide || showHorizontalGuide) {
      ctx.save();
      const cx = (width / 2) * displayPxSize;
      const cy = (height / 2) * displayPxSize;

      const drawGuideAxis = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        isVertical: boolean,
        mirrorActive: boolean
      ) => {
        const lineColor = mirrorActive ? '#FBBF24' : '#38BDF8';
        const tickStep = 4;

        // Subtle dark halo so the guide remains legible over bright pixels
        ctx.save();
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Crisp dashed center axis
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Subtle pixel-interval alignment ticks along the axis
        if (displayPxSize >= 6) {
          ctx.setLineDash([]);
          ctx.lineWidth = 1;
          ctx.strokeStyle = mirrorActive
            ? 'rgba(251, 191, 36, 0.85)'
            : 'rgba(56, 189, 248, 0.85)';
          ctx.beginPath();
          if (isVertical) {
            for (let py = tickStep; py < height; py += tickStep) {
              const tickY = py * displayPxSize + 0.5;
              ctx.moveTo(cx - 4, tickY);
              ctx.lineTo(cx + 4, tickY);
            }
          } else {
            for (let px = tickStep; px < width; px += tickStep) {
              const tickX = px * displayPxSize + 0.5;
              ctx.moveTo(tickX, cy - 4);
              ctx.lineTo(tickX, cy + 4);
            }
          }
          ctx.stroke();
        }
        ctx.restore();
      };

      if (showVerticalGuide) {
        drawGuideAxis(cx, 0, cx, canvasPixelH, true, mirrorX);
      }
      if (showHorizontalGuide) {
        drawGuideAxis(0, cy, canvasPixelW, cy, false, mirrorY);
      }

      // Center intersection marker when both guides are visible
      if (showVerticalGuide && showHorizontalGuide) {
        ctx.fillStyle = '#111318';
        ctx.strokeStyle = mirrorX || mirrorY ? '#FBBF24' : '#38BDF8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw gradient drag guide line
    if (activeTool === 'gradient' && shapeStartRef.current && shapeCurrent && isDrawingRef.current) {
      const sx = (shapeStartRef.current.x + 0.5) * displayPxSize;
      const sy = (shapeStartRef.current.y + 0.5) * displayPxSize;
      const ex = (shapeCurrent.x + 0.5) * displayPxSize;
      const ey = (shapeCurrent.y + 0.5) * displayPxSize;

      ctx.save();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.fillStyle = primaryColor;
      ctx.strokeStyle = '#111318';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = secondaryColor || '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw brush hover cursor
    if (hoverPt && !isPanningRef.current && !spacePressed) {
      const size =
        activeTool === 'pencil' ||
        activeTool === 'dither' ||
        activeTool === 'noise' ||
        activeTool === 'symmetry' ||
        activeTool === 'eraser'
          ? brushSize
          : 1;
      const basePts = expandBrushPoints(hoverPt.x, hoverPt.y, size, width, height);
      const symPts = applySymmetry(basePts, width, height, mirrorX, mirrorY);

      ctx.save();
      ctx.strokeStyle =
        backdrop === 'light' ? 'rgba(17, 24, 39, 0.8)' : 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;
      for (const p of symPts) {
        ctx.strokeRect(
          p.x * displayPxSize + 0.75,
          p.y * displayPxSize + 0.75,
          Math.max(1, displayPxSize - 1.5),
          Math.max(1, displayPxSize - 1.5)
        );
      }
      ctx.restore();
    }
  }, [
    layers,
    activeLayerId,
    previewGrid,
    width,
    height,
    displayPxSize,
    canvasPixelW,
    canvasPixelH,
    showGrid,
    backdrop,
    mirrorX,
    mirrorY,
    guideMode,
    hoverPt,
    spacePressed,
    activeTool,
    brushSize,
    shapeCurrent,
    primaryColor,
    secondaryColor,
  ]);

  const getPixelCoords = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((clientX - rect.left) / rect.width) * width);
      const y = Math.floor(((clientY - rect.top) / rect.height) * height);
      if (x < 0 || x >= width || y < 0 || y >= height) return null;
      return { x, y };
    },
    [width, height]
  );

  const paintPointsOnGrid = useCallback(
    (
      baseGrid: string[],
      pts: Point[],
      tool: ToolId,
      isRightButton: boolean
    ): string[] => {
      const next = [...baseGrid];
      const expanded: Point[] = [];
      for (const pt of pts) {
        expanded.push(...expandBrushPoints(pt.x, pt.y, brushSize, width, height));
      }

      const effectiveTool =
        tool === 'symmetry'
          ? symmetryBrushStyle === 'dither'
            ? 'dither'
            : symmetryBrushStyle === 'noise'
            ? 'noise'
            : 'pencil'
          : tool;

      if (effectiveTool === 'noise') {
        const baseColor = isRightButton ? secondaryColor : primaryColor;
        const partnerColor = isRightButton ? primaryColor : secondaryColor;

        for (const p of expanded) {
          const baseIdx = p.y * width + p.x;
          if (strokeVisitedRef.current.has(baseIdx)) continue;

          const color = generateNoiseColor(baseColor, partnerColor, noiseMode, noiseStrength);
          const mirrored = applySymmetry([p], width, height, mirrorX, mirrorY);
          for (const mp of mirrored) {
            const mIdx = mp.y * width + mp.x;
            strokeVisitedRef.current.add(mIdx);
            next[mIdx] = color;
          }
        }
        return next;
      }

      const finalPts = applySymmetry(expanded, width, height, mirrorX, mirrorY);

      for (const p of finalPts) {
        const idx = p.y * width + p.x;
        if (effectiveTool === 'eraser') {
          next[idx] = '';
        } else if (effectiveTool === 'dither') {
          const usePrimary = evalDitherPattern(p.x, p.y, ditherPattern);
          const chosen = isRightButton
            ? usePrimary
              ? secondaryColor
              : primaryColor
            : usePrimary
            ? primaryColor
            : secondaryColor;
          next[idx] = chosen;
        } else {
          // Pencil: left = primary, right = secondary
          next[idx] = isRightButton ? secondaryColor : primaryColor;
        }
      }
      return next;
    },
    [
      brushSize,
      width,
      height,
      mirrorX,
      mirrorY,
      ditherPattern,
      primaryColor,
      secondaryColor,
      symmetryBrushStyle,
      noiseMode,
      noiseStrength,
    ]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);

    // Middle-click or Space+click -> pan
    if (e.button === 1 || spacePressed) {
      isPanningRef.current = true;
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      return;
    }

    const pt = getPixelCoords(e.clientX, e.clientY);
    if (!pt) return;

    const isRight = e.button === 2;

    // Eyedropper or Alt+Click (samples topmost visible non-empty pixel)
    if (activeTool === 'eyedropper' || e.altKey) {
      const idx = pt.y * width + pt.x;
      for (let i = layers.length - 1; i >= 0; i--) {
        if (!layers[i].visible || layers[i].opacity <= 0) continue;
        const sampled = layers[i].grid[idx];
        if (sampled) {
          onPickColor(sampled, isRight);
          break;
        }
      }
      return;
    }

    // Prevent accidental drawing onto a hidden active layer
    if (activeLayer && !activeLayer.visible) {
      return;
    }

    // Bucket flood fill
    if (activeTool === 'bucket') {
      const filled = floodFillGrid(
        grid,
        width,
        height,
        pt.x,
        pt.y,
        isRight ? secondaryColor : primaryColor,
        isRight ? primaryColor : secondaryColor,
        fillStyle,
        ditherPattern,
        noiseMode,
        noiseStrength
      );
      onCommitGrid(filled);
      return;
    }

    // Shape & Gradient drag tools
    if (
      activeTool === 'line' ||
      activeTool === 'rect' ||
      activeTool === 'circle' ||
      activeTool === 'gradient'
    ) {
      isDrawingRef.current = true;
      shapeSeedRef.current = Math.floor(Math.random() * 100000) + 1;
      shapeStartRef.current = pt;
      setShapeCurrent(pt);
      return;
    }

    // Freehand Pencil / Dither Brush / Noise Brush / Eraser
    isDrawingRef.current = true;
    strokeButtonRef.current = e.button;
    strokeVisitedRef.current.clear();
    lastPtRef.current = pt;
    const next = paintPointsOnGrid(grid, [pt], activeTool, isRight);
    setDraftGrid(next);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
      return;
    }

    const pt = getPixelCoords(e.clientX, e.clientY);
    setHoverPt(pt);
    onHoverPixel(pt);

    if (!isDrawingRef.current || !pt) return;

    if (
      activeTool === 'line' ||
      activeTool === 'rect' ||
      activeTool === 'circle' ||
      activeTool === 'gradient'
    ) {
      setShapeCurrent(pt);
      return;
    }

    const prev = lastPtRef.current ?? pt;
    const linePts = getBresenhamLine(prev.x, prev.y, pt.x, pt.y);
    lastPtRef.current = pt;
    const isRight = strokeButtonRef.current === 2;
    setDraftGrid((current) => paintPointsOnGrid(current ?? grid, linePts, activeTool, isRight));
  };

  const finishStroke = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (
      activeTool === 'line' ||
      activeTool === 'rect' ||
      activeTool === 'circle' ||
      activeTool === 'gradient'
    ) {
      if (previewGrid) {
        onCommitGrid(previewGrid);
      }
      shapeStartRef.current = null;
      setShapeCurrent(null);
      return;
    }

    if (draftGrid) {
      onCommitGrid(draftGrid);
      setDraftGrid(null);
    }
    strokeVisitedRef.current.clear();
    lastPtRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const next = Math.max(4, Math.min(36, Math.round(zoom * factor)));
    onChangeZoom(next);
  };

  const backdropClass =
    backdrop === 'checker'
      ? 'checker-bg'
      : backdrop === 'light'
      ? 'bg-[#F3F4F6]'
      : 'bg-[#171921]';

  const cursorClass = spacePressed
    ? 'cursor-grab active:cursor-grabbing'
    : activeTool === 'eyedropper'
    ? 'cursor-crosshair'
    : 'cursor-crosshair';

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full h-full flex items-center justify-center overflow-hidden select-none bg-[#101217]"
    >
      {/* Subtle radial vignette around workspace */}
      <div
        className="relative shadow-[0_24px_64px_rgba(0,0,0,0.65)] ring-1 ring-white/10 rounded-xs"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasPixelW}
          height={canvasPixelH}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onPointerLeave={() => {
            setHoverPt(null);
            onHoverPixel(null);
          }}
          className={`block pixelated ${backdropClass} ${cursorClass}`}
          style={{
            width: `${canvasPixelW}px`,
            height: `${canvasPixelH}px`,
            touchAction: 'none',
          }}
        />
      </div>
    </div>
  );
};
