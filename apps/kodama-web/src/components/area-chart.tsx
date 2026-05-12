type Point = { label: string; value: number };

export function AreaChart({
  data,
  height = 220,
  width = 760,
}: {
  data: Point[];
  height?: number;
  width?: number;
}) {
  if (data.length === 0) return null;

  const padding = { top: 16, right: 16, bottom: 28, left: 32 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = Math.max(max - min, 1);

  const stepX = innerWidth / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + innerHeight - ((d.value - min) / range) * innerHeight,
  }));

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${
    padding.top + innerHeight
  } Z`;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const value = max - (i * range) / ticks;
    const y = padding.top + (i * innerHeight) / ticks;
    return { value, y };
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-56 w-full"
      role="img"
      aria-label="Activity area chart"
    >
      <defs>
        <linearGradient id="kodamaArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((tick, idx) => (
        <g key={idx}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={tick.y}
            y2={tick.y}
            stroke="var(--border)"
            strokeDasharray={idx === yTicks.length - 1 ? "" : "3 4"}
            strokeWidth={idx === yTicks.length - 1 ? 1 : 0.8}
          />
          <text
            x={padding.left - 6}
            y={tick.y}
            fill="var(--muted-foreground)"
            fontSize="10"
            textAnchor="end"
            dominantBaseline="middle"
          >
            {Math.round(tick.value)}
          </text>
        </g>
      ))}

      <g className="text-primary">
        <path d={area} fill="url(#kodamaArea)" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--background)" stroke="currentColor" strokeWidth="1.5" />
        ))}
      </g>

      {data.map((d, i) => (
        <text
          key={d.label}
          x={padding.left + i * stepX}
          y={height - 8}
          fill="var(--muted-foreground)"
          fontSize="10"
          textAnchor="middle"
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}
