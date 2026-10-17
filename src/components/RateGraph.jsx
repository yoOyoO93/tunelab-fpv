import { curve } from '../lib/rates.js';

const COLORS = { roll: 'var(--roll)', pitch: 'var(--pitch)', yaw: 'var(--yaw)' };

// series : [{ key, label, type, params, color?, dashed? }]
export default function RateGraph({ series, height = 260 }) {
  const W = 520;
  const H = height;
  const pad = { l: 46, r: 12, t: 12, b: 28 };
  const data = series.map((s) => ({ ...s, pts: curve(s.type, s.params) }));
  const maxY = Math.max(200, ...data.flatMap((d) => d.pts.map((p) => p[1])));
  const top = Math.ceil(maxY / 200) * 200;
  const sx = (x) => pad.l + x * (W - pad.l - pad.r);
  const sy = (y) => H - pad.b - (y / top) * (H - pad.t - pad.b);
  const yTicks = [];
  for (let v = 0; v <= top; v += top > 1000 ? 400 : 200) yTicks.push(v);
  return (
    <div className="graph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Courbes de rates">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} className="grid" />
            <text x={pad.l - 6} y={sy(v) + 4} textAnchor="end" className="tick">{v}</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((x) => (
          <g key={x}>
            <line x1={sx(x)} x2={sx(x)} y1={pad.t} y2={H - pad.b} className="grid" />
            <text x={sx(x)} y={H - 8} textAnchor="middle" className="tick">{x * 100}%</text>
          </g>
        ))}
        {data.map((d) => (
          <path
            key={d.key}
            d={d.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('')}
            fill="none"
            stroke={d.color || COLORS[d.axis] || 'var(--accent)'}
            strokeWidth={d.dashed ? 1.6 : 2.2}
            strokeDasharray={d.dashed ? '5 4' : undefined}
          />
        ))}
      </svg>
      <div className="legend">
        {data.map((d) => (
          <span key={d.key}>
            <i style={{ background: d.color || COLORS[d.axis] || 'var(--accent)', opacity: d.dashed ? 0.6 : 1 }} />
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
