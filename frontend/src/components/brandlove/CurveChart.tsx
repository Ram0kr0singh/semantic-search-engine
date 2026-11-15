import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SearchItem } from '../../api';
import {
  generateBellCurvePath,
  interpolateRankColor,
  normalizeScores,
} from './curveMath';
import { ResultFlag } from './ResultFlag';

interface CurveChartProps {
  results: SearchItem[];
  activeRank: number | null;
  onHoverRank: (rank: number | null) => void;
  onSelectResult: (item: SearchItem) => void;
  isLoading: boolean;
  queryText: string;
  methodName?: string;
  isReranked?: boolean;
}

export function CurveChart({
  results,
  activeRank,
  onHoverRank,
  onSelectResult,
  isLoading,
  queryText,
  methodName,
  isReranked = false,
}: CurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartId = useId();

  // Baseline and SVG coordinate system
  const VIEW_WIDTH = 1000;
  const VIEW_HEIGHT = 500;
  const BASELINE_Y = 440;
  const MAX_CURVE_HEIGHT = 330;

  // Track animated heights for smooth draw-in and morph transitions
  const [animatedHeights, setAnimatedHeights] = useState<number[]>([]);
  const currentHeightsRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Compute target normalized heights for the current results
  const targetHeights = useMemo(() => {
    const rawScores = results.map((r) => r.score);
    const rels = normalizeScores(rawScores, 0.24, 0.96);
    return rels.map((rel) => rel * MAX_CURVE_HEIGHT);
  }, [results]);

  // Smooth height interpolation on results change
  useEffect(() => {
    if (results.length === 0) {
      currentHeightsRef.current = [];
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      currentHeightsRef.current = targetHeights;
      animationFrameRef.current = requestAnimationFrame(() => {
        setAnimatedHeights(targetHeights);
      });
      return;
    }

    const startTime = performance.now();
    const duration = 750; // ms
    const initialHeights =
      currentHeightsRef.current.length === targetHeights.length
        ? [...currentHeightsRef.current]
        : targetHeights.map(() => 0);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      const next = targetHeights.map((target, idx) => {
        const start = initialHeights[idx] ?? 0;
        // Stagger slightly per rank
        const delayFactor = Math.min(1, Math.max(0, (elapsed - idx * 20) / (duration * 0.85)));
        const itemEased = 1 - Math.pow(1 - delayFactor, 3);
        return start + (target - start) * itemEased;
      });

      currentHeightsRef.current = next;
      setAnimatedHeights(next);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetHeights, results]);

  // Compute curve geometries
  const curves = useMemo(() => {
    return results.map((item, idx) => {
      const currentHeight = animatedHeights[idx] ?? 0;
      const color = interpolateRankColor(item.rank, results.length);

      // Organic spread and center offset for visual depth
      const centerSpreadOffset = ((idx % 5) - 2) * 12;
      const centerX = VIEW_WIDTH / 2 + centerSpreadOffset;
      const sigma = 115 + (idx % 3) * 10;

      const { pathD, peakX, peakY } = generateBellCurvePath(
        centerX,
        BASELINE_Y,
        currentHeight,
        sigma,
        VIEW_WIDTH
      );

      return {
        item,
        pathD,
        peakX,
        peakY,
        color,
        isActive: activeRank === item.rank,
      };
    });
  }, [results, animatedHeights, activeRank]);

  // Find active item for the floating flag tooltip
  const effectiveActiveRank = activeRank ?? (results.length > 0 ? results[0].rank : null);
  const activeCurve = curves.find((c) => c.item.rank === effectiveActiveRank) ?? curves[0];

  // Convert SVG coordinates to DOM pixel coordinates for HTML tooltip
  const [svgScale, setSvgScale] = useState({ scaleX: 1, scaleY: 1 });
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = rect.width || VIEW_WIDTH;
      const h = rect.height || VIEW_HEIGHT;
      setSvgScale({
        scaleX: w / VIEW_WIDTH,
        scaleY: h / VIEW_HEIGHT,
      });
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const flagPixelX = activeCurve ? activeCurve.peakX * svgScale.scaleX : 0;
  const flagPixelY = activeCurve ? activeCurve.peakY * svgScale.scaleY : 0;

  const formatScoreBadge = (score: number) => {
    return score.toFixed(3);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[360px] sm:h-[440px] md:h-[500px] overflow-hidden select-none"
      onMouseLeave={() => onHoverRank(null)}
    >
      {/* Background Ghost Typographic Watermark (Brand Love Score style) */}
      <div
        className="absolute right-4 sm:right-12 bottom-12 sm:bottom-20 pointer-events-none z-0 text-right opacity-35 dark:opacity-20 transition-opacity"
        aria-hidden="true"
      >
        <div className="font-extrabold text-4xl sm:text-6xl md:text-8xl tracking-tight leading-none text-[var(--bl-text-ghost)] uppercase select-none font-mono">
          {results.length > 0 ? `TOP ${results.length}` : 'ARXIV'}
        </div>
        <div className="font-light text-2xl sm:text-4xl md:text-5xl tracking-widest leading-tight text-[var(--bl-text-ghost)] uppercase select-none">
          {queryText ? queryText.slice(0, 20) : methodName || 'RESEARCH'}
        </div>
      </div>

      {/* SVG Canvas for Curves and Baseline */}
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className="relative z-10 w-full h-full"
        aria-label={isReranked ? 'Relevance score bell curves' : 'Semantic similarity bell curves'}
        role="region"
      >
        <defs>
          <linearGradient id={`${chartId}-baseline-glow`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8a2be2" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#ff3d5a" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#8a2be2" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Common Horizontal Baseline */}
        <line
          x1="0"
          y1={BASELINE_Y}
          x2={VIEW_WIDTH}
          y2={BASELINE_Y}
          stroke={isLoading ? `url(#${chartId}-baseline-glow)` : 'var(--bl-border, rgba(255, 255, 255, 0.15))'}
          strokeWidth={isLoading ? 2 : 1}
          className={isLoading ? 'animate-pulse' : ''}
        />

        {/* Loading pulsing wave */}
        {isLoading && (
          <path
            d={`M 0 ${BASELINE_Y} Q ${VIEW_WIDTH / 2} ${BASELINE_Y - 40} ${VIEW_WIDTH} ${BASELINE_Y}`}
            fill="none"
            stroke="url(#chartId-baseline-glow)"
            strokeWidth="1.5"
            className="animate-pulse"
          />
        )}

        {/* Empty state prompt */}
        {!isLoading && results.length === 0 && (
          <text
            x={VIEW_WIDTH / 2}
            y={BASELINE_Y - 40}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="12"
            letterSpacing="0.25em"
            className="uppercase font-semibold select-none"
          >
            Enter a search query to reveal curve distribution
          </text>
        )}

        {/* Overlapping Curves */}
        {curves.map((curve) => {
          const isDimmed = activeRank !== null && !curve.isActive;
          const strokeOpacity = isDimmed ? 0.25 : curve.isActive ? 1.0 : 0.72;
          const strokeWidth = curve.isActive ? 2.2 : 1.1;

          return (
            <g key={curve.item.id} className="transition-opacity duration-200">
              {/* Visible thin bell curve stroke */}
              <path
                d={curve.pathD}
                fill="none"
                stroke={curve.color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                style={{
                  filter: curve.isActive
                    ? `drop-shadow(0 0 8px ${curve.color})`
                    : 'none',
                  transition: 'stroke-width 180ms ease, stroke-opacity 180ms ease',
                }}
              />

              {/* Invisible wider path for effortless mouse and keyboard interaction */}
              <path
                d={curve.pathD}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                className="cursor-pointer focus:outline-none"
                tabIndex={0}
                role="button"
                aria-label={`Rank ${curve.item.rank}: ${curve.item.title}, Score: ${curve.item.score.toFixed(3)}`}
                onMouseEnter={() => onHoverRank(curve.item.rank)}
                onFocus={() => onHoverRank(curve.item.rank)}
                onClick={() => onSelectResult(curve.item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectResult(curve.item);
                  }
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Floating Flag Tooltip on the active/hovered peak */}
      {activeCurve && !isLoading && results.length > 0 && (
        <ResultFlag
          x={flagPixelX}
          y={flagPixelY}
          scoreText={formatScoreBadge(activeCurve.item.score)}
          scoreLabel={isReranked ? 'Relevance score' : 'Score'}
          title={activeCurve.item.title}
          visible={true}
          onClick={() => onSelectResult(activeCurve.item)}
        />
      )}
      <p className="absolute bottom-1 left-4 right-4 z-20 text-xs text-[var(--text-muted)] text-center">
        Curve heights are relative within this list of results. Scores cannot be compared between approaches or between searches.
      </p>
    </div>
  );
}
