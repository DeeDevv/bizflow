import { formatCompactCurrency } from "@/lib/utils";

/**
 * Lightweight inline SVG area/line chart.
 * Avoids a charting dependency for Phase 1; renders identically on server and client.
 */

export interface SparklineSeries {
  label: string;
  /** Raw values; scaled automatically */
  values: number[];
  /** Hex color for the stroke, e.g. "#4f46e5" */
  color: string;
  /** Fill under the line (area chart). Omit for a plain line. */
  fill?: boolean;
}

interface SparklineProps {
  series: SparklineSeries[];
  height?: number;
  /** Show hover marker at this x index (0-based) — used by the interactive revenue chart */
  activeIndex?: number | null;
  /** Show y-axis value labels on the gridlines (off for tiny sparklines) */
  showAxisLabels?: boolean;
  /** How to render y-axis values; defaults to compact currency */
  formatValue?: (value: number) => string;
  className?: string;
}

const VIEW_W = 600;
const VIEW_H = 220;
const PAD_TOP = 10;
const PAD_BOTTOM = 6;

function buildPath(values: number[], min: number, max: number): {
  line: string;
  area: string;
} {
  const range = max - min || 1;
  const usableH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const stepX = VIEW_W / (values.length - 1);

  const points = values.map((v, i) => ({
    x: i * stepX,
    y: PAD_TOP + (1 - (v - min) / range) * usableH,
  }));

  // Smooth cubic through midpoints
  let line = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    line += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const area = `${line} L ${points[points.length - 1].x} ${VIEW_H} L ${points[0].x} ${VIEW_H} Z`;

  return { line, area };
}

export function Sparkline({
  series,
  height = 220,
  activeIndex = null,
  showAxisLabels = true,
  formatValue = formatCompactCurrency,
  className,
}: SparklineProps) {
  const all = series.flatMap((s) => s.values);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const count = series[0]?.values.length ?? 0;

  const range = max - min || 1;
  const usableH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const stepX = count > 1 ? VIEW_W / (count - 1) : 0;

  // Horizontal gridlines at 0/25/50/75/100% of the value range
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => PAD_TOP + t * usableH);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      style={{ height }}
      className={className}
      role="img"
      aria-label={series.map((s) => `${s.label} chart`).join(" and ")}
    >
      <defs>
        {series.map((s, i) =>
          s.fill ? (
            <linearGradient
              key={s.label}
              id={`spark-fill-${i}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ) : null,
        )}
      </defs>

      {gridYs.map((y, i) => {
        const value = max - (i / 4) * range;
        return (
          <g key={i}>
            <line
              x1="0"
              y1={y}
              x2={VIEW_W}
              y2={y}
              className="stroke-zinc-100"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {i > 0 && showAxisLabels && (
              <text
                x="4"
                y={y - 4}
                className="fill-zinc-400"
                style={{ fontSize: 10, fontFamily: "var(--font-sans)" }}
              >
                {formatValue(value)}
              </text>
            )}
          </g>
        );
      })}

      {series.map((s, i) => {
        const { line, area } = buildPath(s.values, min, max);
        return (
          <g key={s.label}>
            {s.fill ? <path d={area} fill={`url(#spark-fill-${i})`} stroke="none" /> : null}
            <path
              d={line}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}

      {/* Active-point marker (desktop hover) */}
      {activeIndex != null && count > 0 && (
        <g>
          <line
            x1={activeIndex * stepX}
            y1={PAD_TOP}
            x2={activeIndex * stepX}
            y2={VIEW_H - PAD_BOTTOM}
            className="stroke-zinc-300"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          {series.map((s) => {
            const y = PAD_TOP + (1 - (s.values[activeIndex] - min) / range) * usableH;
            return (
              <circle
                key={s.label}
                cx={activeIndex * stepX}
                cy={y}
                r="4"
                fill={s.color}
                stroke="#fff"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>
      )}
    </svg>
  );
}
