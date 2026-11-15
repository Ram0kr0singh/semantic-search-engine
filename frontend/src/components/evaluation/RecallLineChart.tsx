import { useState, useId } from 'react';
import type { EvaluationRun } from '../../api';
import { evaluationLabel } from '../../evaluation';

interface RecallLineChartProps {
  runs: EvaluationRun[];
  hoveredMethod: string | null;
  onHoverMethod: (method: string | null) => void;
}

const PALETTE = [
  '#ff3d5a', // Hot pink-red
  '#06b6d4', // Cyan
  '#8a2be2', // Violet
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#14b8a6', // Teal
  '#f43f5e', // Rose
  '#6366f1', // Indigo
  '#64748b', // Slate
];

export function RecallLineChart({
  runs,
  hoveredMethod,
  onHoverMethod,
}: RecallLineChartProps) {
  const chartId = useId();
  const [activeXIndex, setActiveXIndex] = useState<number | null>(null);

  // SVG coordinate dimensions
  const width = 640;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 45;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // X points: Recall@1, Recall@10, Recall@100
  const xPositions = [
    paddingLeft,
    paddingLeft + chartWidth / 2,
    paddingLeft + chartWidth,
  ];

  const xLabels = ['Recall@1', 'Recall@10', 'Recall@100'];

  // Map each run to its points
  const lines = runs.map((run, idx) => {
    const label = evaluationLabel(run);
    const color = PALETTE[idx % PALETTE.length];
    const r1 = Math.min(1, Math.max(0, run.recall_at_1 ?? 0));
    const r10 = Math.min(1, Math.max(0, run.recall_at_10 ?? 0));
    const r100 = Math.min(1, Math.max(0, run.recall_at_100 ?? 0));

    const y0 = paddingTop + (1 - r1) * chartHeight;
    const y1 = paddingTop + (1 - r10) * chartHeight;
    const y2 = paddingTop + (1 - r100) * chartHeight;

    const x0 = xPositions[0];
    const x1 = xPositions[1];
    const x2 = xPositions[2];

    const dx1 = (x1 - x0) * 0.5;
    const dx2 = (x2 - x1) * 0.5;

    const pathD = `M ${x0} ${y0} C ${x0 + dx1} ${y0}, ${x1 - dx1} ${y1}, ${x1} ${y1} C ${x1 + dx2} ${y1}, ${x2 - dx2} ${y2}, ${x2} ${y2}`;

    return {
      run,
      label,
      color,
      pathD,
      points: [
        { x: x0, y: y0, val: r1 },
        { x: x1, y: y1, val: r10 },
        { x: x2, y: y2, val: r100 },
      ],
      isHovered: hoveredMethod === label,
    };
  });

  const activeLine = lines.find((l) => l.isHovered) ?? null;

  return (
    <div
      className="space-y-4 pt-4 select-none"
      onMouseLeave={() => {
        onHoverMethod(null);
        setActiveXIndex(null);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--text)] block">
            Recall Progression Curves
          </span>
          <span className="text-xs font-mono text-[var(--text-muted)] tracking-wider uppercase">
            Recall@1 → Recall@10 → Recall@100 cutoff depth
          </span>
        </div>
        {activeLine && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[var(--surface-raised)] border border-[var(--border)] text-xs font-mono">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: activeLine.color }}
            />
            <span className="font-bold text-[var(--text)]">
              {activeLine.label}
            </span>
            <span className="text-[var(--text-muted)]">
              R@1: {(activeLine.run.recall_at_1 ?? 0).toFixed(3)} · R@100: {(activeLine.run.recall_at_100 ?? 0).toFixed(3)}
            </span>
          </div>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[280px]"
          aria-label="Recall Progression Chart across models"
        >
          {/* Background Dotted Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingTop + (1 - ratio) * chartHeight;
            return (
              <g key={ratio}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="var(--border-subtle)"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="12"
                  fontFamily="monospace"
                >
                  {ratio.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Vertical Cutoff Depth Guidelines */}
          {xPositions.map((x, idx) => (
            <g key={xLabels[idx]}>
              <line
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={paddingTop + chartHeight}
                stroke={activeXIndex === idx ? 'var(--bl-accent-hot,#ff3d5a)' : 'var(--border-subtle)'}
                strokeDasharray={activeXIndex === idx ? 'none' : '4 4'}
                strokeWidth={activeXIndex === idx ? 1.5 : 1}
                className="transition-colors"
              />
              <text
                x={x}
                y={paddingTop + chartHeight + 18}
                textAnchor="middle"
                fill={activeXIndex === idx ? 'var(--text)' : 'var(--text-muted)'}
                fontSize="12"
                fontWeight="bold"
                fontFamily="monospace"
                className="uppercase tracking-wider"
              >
                {xLabels[idx]}
              </text>
            </g>
          ))}

          {/* Interactive Mouse Capture Columns */}
          {xPositions.map((x, idx) => (
            <rect
              key={`hit-${idx}`}
              x={x - chartWidth / 4}
              y={paddingTop}
              width={chartWidth / 2}
              height={chartHeight}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setActiveXIndex(idx)}
            />
          ))}

          {/* Smooth Curves for each method */}
          {lines.map((line) => {
            const isDimmed = hoveredMethod !== null && !line.isHovered;
            const strokeWidth = line.isHovered ? 3.0 : 1.5;
            const strokeOpacity = isDimmed ? 0.25 : line.isHovered ? 1.0 : 0.75;

            return (
              <g key={line.label} className="transition-opacity duration-200">
                {/* Visible curved stroke */}
                <path
                  d={line.pathD}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  style={{
                    filter: line.isHovered
                      ? `drop-shadow(0 0 6px ${line.color})`
                      : 'none',
                    transition: 'stroke-width 150ms ease, stroke-opacity 150ms ease',
                  }}
                />

                {/* Point nodes at each cutoff */}
                {line.points.map((pt, pIdx) => (
                  <circle
                    key={pIdx}
                    cx={pt.x}
                    cy={pt.y}
                    r={line.isHovered ? 4.5 : 2.5}
                    fill={line.isHovered ? line.color : 'var(--surface)'}
                    stroke={line.color}
                    strokeWidth={line.isHovered ? 2 : 1.5}
                    strokeOpacity={strokeOpacity}
                    className="transition-all"
                  />
                ))}

                {/* Wide invisible hit path for effortless hover */}
                <path
                  d={line.pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  aria-label={`${line.label}: R@1 ${line.run.recall_at_1?.toFixed(3)}, R@10 ${line.run.recall_at_10?.toFixed(3)}, R@100 ${line.run.recall_at_100?.toFixed(3)}`}
                  onMouseEnter={() => onHoverMethod(line.label)}
                  onFocus={() => onHoverMethod(line.label)}
                />
              </g>
            );
          })}

          {/* Floating Tooltip Bubble when active point is hovered */}
          {activeLine && activeXIndex !== null && (
            <g
              transform={`translate(${activeLine.points[activeXIndex].x}, ${activeLine.points[activeXIndex].y})`}
              className="pointer-events-none animate-in fade-in zoom-in-95 duration-150"
            >
              <rect
                x="-40"
                y="-32"
                width="80"
                height="24"
                rx="4"
                fill="var(--surface-raised)"
                stroke="var(--border)"
                strokeWidth="1"
                className="shadow-lg"
              />
              <text
                x="0"
                y="-16"
                textAnchor="middle"
                fill="var(--text)"
                fontSize="12"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {activeLine.points[activeXIndex].val.toFixed(4)}
              </text>
              <circle cx="0" cy="0" r="5" fill={activeLine.color} stroke="white" strokeWidth="1.5" />
            </g>
          )}
        </svg>
      </div>

      {/* Legend with interactive square swatches */}
      <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 pt-2 border-t border-[var(--border-subtle)] text-xs font-mono uppercase">
        {lines.map((line) => (
          <button
            key={`legend-${line.label}-${chartId}`}
            type="button"
            onMouseEnter={() => onHoverMethod(line.label)}
            onFocus={() => onHoverMethod(line.label)}
            onMouseLeave={() => onHoverMethod(null)}
            onBlur={() => onHoverMethod(null)}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded transition-all cursor-pointer ${
              line.isHovered
                ? 'bg-[var(--surface-raised)] text-[var(--text)] font-bold scale-105'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-xs shrink-0"
              style={{ backgroundColor: line.color }}
            />
            <span className="truncate max-w-[140px]">{line.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
