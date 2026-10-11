// A small area chart with a value axis and date labels, drawn as SVG.
interface Point {
  /** Unix seconds. */
  time: number;
  value: number;
}

const W = 1000;
const H = 260;
const PAD = { left: 56, right: 8, top: 12, bottom: 28 };

export function AreaChart({ points, format }: { points: Point[]; format: (value: number) => string }) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const max = Math.max(...points.map((p) => p.value));
  // A flat line needs a band around it, or it would sit on the axis.
  const top = max > 0 ? max * 1.15 : 1;
  const span = Math.max(last.time - first.time, 1);
  const x = (time: number) => PAD.left + ((time - first.time) / span) * (W - PAD.left - PAD.right);
  const y = (value: number) => H - PAD.bottom - (value / top) * (H - PAD.top - PAD.bottom);
  // Holdings change in steps, so hold each value until the next point.
  const line = points.flatMap((p, i) => {
    const previous = points[i - 1];
    return previous
      ? [`${x(p.time)},${y(previous.value)}`, `${x(p.time)},${y(p.value)}`]
      : [`${x(p.time)},${y(p.value)}`];
  });
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);
  const dates = [0, 0.25, 0.5, 0.75, 1].map((f) => first.time + span * f);
  const day = new Intl.DateTimeFormat(
    "en-GB",
    span > 172_800 ? { day: "2-digit", month: "short" } : { hour: "2-digit", minute: "2-digit" },
  );

  return (
    <svg className="area-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Portfolio value over time">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
          <text x={PAD.left - 10} y={y(tick) + 4} textAnchor="end">
            {format(tick)}
          </text>
        </g>
      ))}
      {dates.map((time, i) => (
        <text
          key={time}
          x={x(time)}
          y={H - 6}
          textAnchor={i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"}
        >
          {day.format(time * 1000)}
        </text>
      ))}
      <polygon points={`${PAD.left},${y(0)} ${line.join(" ")} ${W - PAD.right},${y(0)}`} />
      <polyline points={line.join(" ")} />
    </svg>
  );
}
