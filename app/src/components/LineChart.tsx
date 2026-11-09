import { useEffect, useMemo, useRef, useState } from 'react';

export interface Series {
  key: string;
  label: string;
  /** CSS colour for the line (validated categorical slot). Text never uses it. */
  color: string;
  values: number[];
}

interface Props {
  /** One label per point, e.g. "3 Nov". */
  labels: string[];
  series: Series[];
  /** Full money format for the tooltip and table. */
  format: (n: number) => string;
  /** Short format for the axis, e.g. "₦12k". */
  formatAxis: (n: number) => string;
  title: string;
  height?: number;
}

/** "Nice" round axis steps that include zero. */
function ticks(min: number, max: number, count = 4): number[] {
  if (min === max) max = min + 1;
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Revenue vs profit over time: one shared money axis, 2px lines, crosshair + tooltip, table view. */
export function LineChart({ labels, series, format, formatAxis, title, height = 220 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = labels.length;
  const all = series.flatMap(s => s.values);
  const yTicks = useMemo(() => ticks(Math.min(0, ...all), Math.max(0, ...all)), [all]);
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];

  const pad = { top: 12, right: 64, bottom: 26, left: 56 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => pad.top + h - ((v - yMin) / (yMax - yMin || 1)) * h;
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');

  // Show at most ~6 x labels so they never collide.
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 70))));
  const xLabelIdx = labels.map((_, i) => i).filter(i => i % every === 0 || i === n - 1);
  if (xLabelIdx.length > 1 && xLabelIdx[xLabelIdx.length - 1] - xLabelIdx[xLabelIdx.length - 2] < every) {
    xLabelIdx.splice(xLabelIdx.length - 2, 1);
  }

  // End-of-line labels, nudged apart when the lines end close together.
  const ends = series.map(s => ({ s, y: y(s.values[n - 1] ?? 0) }));
  if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 14) {
    const mid = (ends[0].y + ends[1].y) / 2;
    const up = ends[0].y <= ends[1].y ? 0 : 1;
    ends[up].y = mid - 7;
    ends[1 - up].y = mid + 7;
  }

  const pick = (clientX: number) => {
    const rect = wrap.current?.querySelector('svg')?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const px = clientX - rect.left - pad.left;
    setHover(Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (px / w) * (n - 1)))));
  };

  return (
    <div className="lc" ref={wrap}>
      <div className="lc-head">
        <div className="lc-legend" aria-hidden>
          {series.map(s => (
            <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
          ))}
        </div>
        <button type="button" className="link-btn lc-toggle" onClick={() => setAsTable(t => !t)}>
          {asTable ? 'Show as chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <div className="lc-table-wrap">
          <table className="lc-table">
            <caption className="sr-only">{title}</caption>
            <thead><tr><th scope="col">Date</th>{series.map(s => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={l + i}><th scope="row">{l}</th>{series.map(s => <td key={s.key}>{format(s.values[i])}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="lc-plot">
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${title}. Use "Show as table" for the numbers.`}
            onMouseMove={e => pick(e.clientX)}
            onMouseLeave={() => setHover(null)}
            onTouchStart={e => pick(e.touches[0].clientX)}
            onTouchMove={e => pick(e.touches[0].clientX)}
          >
            {yTicks.map(t => (
              <g key={t}>
                <line x1={pad.left} x2={pad.left + w} y1={y(t)} y2={y(t)} className={t === 0 ? 'lc-zero' : 'lc-grid'} />
                <text x={pad.left - 8} y={y(t)} className="lc-axis" textAnchor="end" dominantBaseline="middle">{formatAxis(t)}</text>
              </g>
            ))}
            {xLabelIdx.map(i => (
              <text key={i} x={x(i)} y={height - 6} className="lc-axis" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{labels[i]}</text>
            ))}
            {series.map(s => (
              <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {n === 1 && series.map(s => <circle key={s.key} cx={x(0)} cy={y(s.values[0])} r={4} fill={s.color} />)}
            {ends.map(({ s, y: ly }) => (
              <text key={s.key} x={pad.left + w + 8} y={ly} className="lc-end" dominantBaseline="middle">{s.label}</text>
            ))}
            {hover != null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + h} className="lc-cross" />
                {series.map(s => (
                  <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
          {hover != null && (
            <div
              className="lc-tip"
              role="status"
              style={{ left: Math.min(Math.max(x(hover) - 80, 0), width - 168), top: 4 }}
            >
              <strong>{labels[hover]}</strong>
              {series.map(s => (
                <div key={s.key}><i style={{ background: s.color }} />{s.label}<b>{format(s.values[hover])}</b></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
