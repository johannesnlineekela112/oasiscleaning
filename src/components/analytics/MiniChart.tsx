/**
 * MiniChart.tsx
 * Pure-SVG chart primitives — zero runtime dependencies.
 */

import { useMemo } from "react";

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function nice(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return String(Math.round(v));
}

export interface LinePoint { label: string; value: number; value2?: number }

export function LineChart({
  data, height = 180, color = "hsl(var(--primary))", color2 = "hsl(var(--info))",
  label2, showDots = true, showArea = true, className = "",
}: {
  data: LinePoint[]; height?: number; color?: string; color2?: string;
  label2?: string; showDots?: boolean; showArea?: boolean; className?: string;
}) {
  const W = 520; const H = height;
  const PAD = { t: 8, r: 12, b: 36, l: 44 };
  const IW = W - PAD.l - PAD.r; const IH = H - PAD.t - PAD.b;

  const { points, points2, maxY, xLabels } = useMemo(() => {
    if (!data.length) return { points: [], points2: [], maxY: 1, xLabels: [] };
    const vals = data.map(d => d.value);
    const vals2 = data.map(d => d.value2 ?? 0);
    const maxY = Math.max(...(label2 ? [...vals, ...vals2] : vals), 1);
    const scaleX = (i: number) => PAD.l + (i / (data.length - 1 || 1)) * IW;
    const scaleY = (v: number) => PAD.t + IH - clamp(v / maxY, 0, 1) * IH;
    const points  = data.map((d, i) => [scaleX(i), scaleY(d.value)] as [number, number]);
    const points2 = label2 ? data.map((d, i) => [scaleX(i), scaleY(d.value2 ?? 0)] as [number, number]) : [];
    const step = Math.ceil(data.length / 7);
    const xLabels = data.map((d, i) => ({ label: d.label, x: scaleX(i), show: i % step === 0 || i === data.length - 1 }));
    return { points, points2, maxY, xLabels };
  }, [data, label2]);

  const toPath = (pts: [number, number][], close = false) => {
    if (!pts.length) return "";
    const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return close ? d + ` L${pts[pts.length-1][0].toFixed(1)},${(PAD.t+IH).toFixed(1)} L${pts[0][0].toFixed(1)},${(PAD.t+IH).toFixed(1)} Z` : d;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: f * maxY, y: PAD.t + IH - f * IH }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-full ${className}`} style={{ height }}>
      {yTicks.map(({ v, y }) => (
        <g key={y}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth={0.5} />
          <text x={PAD.l - 6} y={y + 4} fontSize={9} fill="hsl(var(--muted-foreground))" textAnchor="end">{nice(v)}</text>
        </g>
      ))}
      {showArea && points.length > 1 && <path d={toPath(points, true)} fill={color} fillOpacity={0.1} />}
      {showArea && points2.length > 1 && <path d={toPath(points2, true)} fill={color2} fillOpacity={0.08} />}
      {points.length > 1 && <path d={toPath(points)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {points2.length > 1 && <path d={toPath(points2)} fill="none" stroke={color2} strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />}
      {showDots && points.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill={color} stroke="hsl(var(--background))" strokeWidth={1.5} />)}
      {xLabels.filter(l => l.show).map(({ x, label }) => (
        <text key={label} x={x} y={H - 4} fontSize={9} fill="hsl(var(--muted-foreground))" textAnchor="middle">{label}</text>
      ))}
    </svg>
  );
}

export interface BarItem { label: string; value: number; color?: string }

export function BarChart({ data, height = 200, className = "" }: { data: BarItem[]; height?: number; className?: string }) {
  const W = 520; const H = height;
  const PAD = { t: 8, r: 12, b: 52, l: 52 };
  const IW = W - PAD.l - PAD.r; const IH = H - PAD.t - PAD.b;
  const COLORS = ["hsl(var(--primary))","hsl(var(--info))","hsl(var(--success))","#f59e0b","#8b5cf6","#ec4899"];
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barW = Math.max(8, IW / data.length - 6);
  const gap  = (IW - barW * data.length) / (data.length + 1);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: f * maxVal, y: PAD.t + IH - f * IH }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-full ${className}`} style={{ height }}>
      {yTicks.map(({ v, y }) => (
        <g key={y}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth={0.5} />
          <text x={PAD.l - 6} y={y + 4} fontSize={9} fill="hsl(var(--muted-foreground))" textAnchor="end">{nice(v)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * IH;
        const x = PAD.l + gap + i * (barW + gap);
        const y = PAD.t + IH - barH;
        const c = d.color ?? COLORS[i % COLORS.length];
        const lbl = d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, 1)} rx={3} fill={c} fillOpacity={0.85} />
            {barH > 16 && <text x={x + barW/2} y={y - 3} fontSize={8} fill="hsl(var(--foreground))" textAnchor="middle">N${nice(d.value)}</text>}
            <text x={x + barW/2} y={H - PAD.b + 14} fontSize={9} fill="hsl(var(--muted-foreground))" textAnchor="middle"
              transform={`rotate(-30, ${x + barW/2}, ${H - PAD.b + 14})`}>{lbl}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function DonutGauge({ value, size = 80, color = "hsl(var(--primary))", label, sub }: {
  value: number; size?: number; color?: string; label?: string; sub?: string;
}) {
  const r = (size / 2) - 7;
  const circ = 2 * Math.PI * r;
  const dash = (clamp(value, 0, 100) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      {label && <text x={size/2} y={size/2 + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="hsl(var(--foreground))">{label}</text>}
      {sub && <text x={size/2} y={size/2 + 16} textAnchor="middle" fontSize={8} fill="hsl(var(--muted-foreground))">{sub}</text>}
    </svg>
  );
}
