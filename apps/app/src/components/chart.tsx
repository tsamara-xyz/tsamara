// An area chart with a value axis on the right and time labels below, drawn as SVG.
import { useId } from "react";

interface Point {
  /** Unix seconds. */
  time: number;
  value: number;
}

const W = 1000;
const H = 300;
const PAD = { left: 0, right: 72, top: 12, bottom: 34 };
const STEPS = [0, 0.2, 0.4, 0.6, 0.8, 1];

/** The top of the value axis: a little above the maximum, on a round step so the five gridlines read cleanly. */
export function axisTop(max: number): number {
  if (max <= 0) return 1;
  const raw = (max * 1.1) / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  return step * 5;
}

export function AreaChart({
  points,
  format,
  label,
}: {
  points: Point[];
  format: (value: number) => string;
  label: string;
}) {
  const gradient = useId();
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const top = axisTop(Math.max(...points.map((p) => p.value)));
  const span = Math.max(last.time - first.time, 1);
  const right = W - PAD.right;
  const x = (time: number) => PAD.left + ((time - first.time) / span) * (right - PAD.left);
  const y = (value: number) => H - PAD.bottom - (value / top) * (H - PAD.top - PAD.bottom);
  // Holdings change in steps, so hold each value until the next point.
  const line = points.flatMap((p, i) => {
    const previous = points[i - 1];
    return previous
      ? [`${x(p.time)},${y(previous.value)}`, `${x(p.time)},${y(p.value)}`]
      : [`${x(p.time)},${y(p.value)}`];
  });
  // An empty history would label every line with the same zero; keep one line per distinct label.
  const ticks = STEPS.map((f) => top * f).filter(
    (tick, i, all) => all.findIndex((t) => format(t) === format(tick)) === i,
  );
  const day = new Intl.DateTimeFormat(
    "en-GB",
    span > 172_800 ? { day: "2-digit", month: "short" } : { hour: "2-digit", minute: "2-digit" },
  );

  return (
    <svg className="area-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0f7a4f" stopOpacity="0.28" />
          <stop offset="1" stopColor="#0f7a4f" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={PAD.left} x2={right} y1={y(tick)} y2={y(tick)} />
          <text x={right + 10} y={y(tick) + 4}>
            {format(tick)}
          </text>
        </g>
      ))}
      {STEPS.map((f, i) => (
        <text
          key={f}
          x={PAD.left + f * (right - PAD.left)}
          y={H - 8}
          textAnchor={i === 0 ? "start" : i === STEPS.length - 1 ? "end" : "middle"}
        >
          {day.format((first.time + span * f) * 1000)}
        </text>
      ))}
      <polygon fill={`url(#${gradient})`} points={`${PAD.left},${y(0)} ${line.join(" ")} ${right},${y(0)}`} />
      <polyline points={line.join(" ")} />
    </svg>
  );
}
