"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { itemId, QUALITY_LABELS } from "./types";
import type { AodpRegion, HistoryPoint, SelectedItem } from "./types";

const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 52;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

const LINE_COLOR = "#e0b559"; // gold-400 — the single series, our accent
const AVG_LINE_COLOR = "#8a9ac2"; // navy-300 — a muted annotation, not data

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  // Fixed "en-US" + spelled-out month rather than the viewer's locale — numeric
  // DD/MM vs MM/DD is genuinely ambiguous, "Aug 2, 2026" never is.
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function PriceHistoryChart({
  item,
  city,
  quality,
  hasQuality,
  region,
  days,
  onClose,
}: {
  item: SelectedItem;
  city: string;
  quality: number;
  hasQuality: boolean;
  region: AodpRegion;
  days: number;
  onClose: () => void;
}) {
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  async function loadHistory() {
    const requestId = ++requestIdRef.current;
    setPoints(null);
    setError(null);

    const params = new URLSearchParams({
      item: itemId(item),
      city,
      quality: String(quality),
      region,
      days: String(Math.max(days, 7)),
    });

    try {
      const res = await fetch(`/api/market/history?${params.toString()}`);
      const data = await res.json();
      if (requestIdRef.current !== requestId) return;
      if (!res.ok) {
        setError(data.detail ?? data.error ?? `Request failed (${res.status})`);
        return;
      }
      setPoints(data.history ?? []);
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    }
  }

  // Mount-only: the parent gives this component a fresh `key` per (city, quality)
  // selection (see PriceGrid.tsx), so a prop change here means React remounts a
  // new instance rather than this effect re-running with different deps.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount; loadHistory guards itself via requestIdRef
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const geometry = useMemo(() => {
    if (!points || points.length === 0) return null;

    const prices = points.map((p) => p.avgPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = (max - min) * 0.1 || max * 0.1 || 1;
    const yMin = Math.max(0, min - pad);
    const yMax = max + pad;

    const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const x = (i: number) =>
      points.length === 1 ? PAD_LEFT + plotWidth / 2 : PAD_LEFT + (i / (points.length - 1)) * plotWidth;
    const y = (price: number) => PAD_TOP + (1 - (price - yMin) / (yMax - yMin)) * plotHeight;

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.avgPrice)}`).join(" ");
    const areaPath = `${linePath} L${x(points.length - 1)},${PAD_TOP + plotHeight} L${x(0)},${PAD_TOP + plotHeight} Z`;

    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    return { x, y, yMin, yMax, linePath, areaPath, avgPrice, plotWidth, plotHeight };
  }, [points]);

  const qualityLabel = hasQuality ? QUALITY_LABELS[quality] : "Normal";

  return (
    <div className="mt-2 rounded-lg border border-navy-600 bg-navy-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-navy-100">
          {city} Market — {qualityLabel} Quality
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-navy-400 hover:text-navy-100"
          aria-label="Close chart"
        >
          ×
        </button>
      </div>

      {error && <p className="text-sm text-red-300">Failed to load history: {error}</p>}
      {!error && points === null && <p className="text-sm text-navy-300">Loading history…</p>}
      {!error && points !== null && points.length === 0 && (
        <p className="text-sm text-navy-400">No price history for this selection in the last {days} days.</p>
      )}

      {!error && geometry && points && points.length > 0 && (
        <div className="relative">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label={`Price history for ${item.name} in ${city}`}
            onMouseLeave={() => setHoverIndex(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
              let nearest = 0;
              let nearestDist = Infinity;
              points.forEach((_, i) => {
                const dist = Math.abs(geometry.x(i) - relX);
                if (dist < nearestDist) {
                  nearestDist = dist;
                  nearest = i;
                }
              });
              setHoverIndex(nearest);
            }}
          >
            {/* Y-axis gridlines + ticks — hairline, solid, recessive */}
            {[0, 0.5, 1].map((t) => {
              const price = geometry.yMin + (geometry.yMax - geometry.yMin) * (1 - t);
              const yPos = PAD_TOP + t * geometry.plotHeight;
              return (
                <g key={t}>
                  <line
                    x1={PAD_LEFT}
                    x2={WIDTH - PAD_RIGHT}
                    y1={yPos}
                    y2={yPos}
                    stroke="#182036"
                    strokeWidth={1}
                  />
                  <text x={PAD_LEFT - 8} y={yPos + 3} textAnchor="end" fontSize={10} fill="#56699a">
                    {formatCompact(price)}
                  </text>
                </g>
              );
            })}

            {/* Average reference line — dashed, muted, distinct from the data line */}
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={geometry.y(geometry.avgPrice)}
              y2={geometry.y(geometry.avgPrice)}
              stroke={AVG_LINE_COLOR}
              strokeWidth={1}
              strokeDasharray="4 3"
            />

            {/* Area wash under the line */}
            <path d={geometry.areaPath} fill={LINE_COLOR} fillOpacity={0.1} stroke="none" />

            {/* The data line */}
            <path
              d={geometry.linePath}
              fill="none"
              stroke={LINE_COLOR}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* End marker */}
            <circle
              cx={geometry.x(points.length - 1)}
              cy={geometry.y(points[points.length - 1].avgPrice)}
              r={4}
              fill={LINE_COLOR}
              stroke="#0c101c"
              strokeWidth={2}
            />

            {/* Crosshair */}
            {hoverIndex !== null && (
              <>
                <line
                  x1={geometry.x(hoverIndex)}
                  x2={geometry.x(hoverIndex)}
                  y1={PAD_TOP}
                  y2={PAD_TOP + geometry.plotHeight}
                  stroke="#56699a"
                  strokeWidth={1}
                />
                <circle
                  cx={geometry.x(hoverIndex)}
                  cy={geometry.y(points[hoverIndex].avgPrice)}
                  r={4}
                  fill={LINE_COLOR}
                  stroke="#0c101c"
                  strokeWidth={2}
                />
              </>
            )}
          </svg>

          {hoverIndex !== null && (
            <div
              className="pointer-events-none absolute top-0 rounded border border-navy-600 bg-navy-800 px-2 py-1 text-xs shadow-lg"
              style={{
                left: `${(geometry.x(hoverIndex) / WIDTH) * 100}%`,
                transform:
                  hoverIndex > points.length / 2 ? "translateX(-100%)" : "translateX(0)",
              }}
            >
              <div className="font-semibold text-navy-100">
                {points[hoverIndex].avgPrice.toLocaleString()} silver
              </div>
              <div className="text-navy-400">{formatDate(points[hoverIndex].timestamp)}</div>
              <div className="text-navy-400">
                Amount: {points[hoverIndex].itemCount.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
