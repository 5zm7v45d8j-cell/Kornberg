import { useEffect, useState } from 'react';
import type {
  AssetCategoryKey,
  MarketSnapshot,
  TradeSetupIdea,
} from '../types/research';

interface TheoreticalOpenChartProps {
  assetName: string;
  category: AssetCategoryKey;
  snapshot?: MarketSnapshot;
  setup?: TradeSetupIdea;
}

type ScenarioBias = 'long' | 'short';

interface PhasePoint {
  label: string;
  price: number;
  invalidationPrice: number;
  note: string;
}

function formatAxisLevel(val: number, isPercentMode: boolean): string {
  if (isPercentMode) {
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  }
  const abs = Math.abs(val);
  const digits = abs < 5 ? 4 : abs < 200 ? 2 : abs < 5000 ? 1 : 0;
  return val.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function getOpenAxisLabels(assetName: string, category: AssetCategoryKey): string[] {
  if (assetName === 'DAX 40') {
    return ['Vorbörse', '09:00 Open', '+15m', '+30m', '+60m', '+120m'];
  }
  if (category === 'krypto') {
    return ['15:00 Pre', '15:30 US-Open', '+15m', '+30m', '+60m', '+120m'];
  }
  return ['Vorbörse', '15:30 Open', '+15m', '+30m', '+60m', '+120m'];
}

export function TheoreticalOpenChart({
  assetName,
  category,
  snapshot,
  setup,
}: TheoreticalOpenChartProps) {
  const defaultBias: ScenarioBias =
    setup?.direction === 'Short (Rücksetzer-Szenario)' ? 'short' : 'long';
  const [scenarioBias, setScenarioBias] = useState<ScenarioBias>(defaultBias);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (setup?.direction === 'Short (Rücksetzer-Szenario)') {
      setScenarioBias('short');
    } else if (setup?.direction === 'Long (Dip-Szenario)') {
      setScenarioBias('long');
    }
  }, [setup?.direction]);

  const timeLabels = getOpenAxisLabels(assetName, category);

  const hasLivePrice =
    typeof snapshot?.latest_close === 'number' &&
    Number.isFinite(snapshot.latest_close) &&
    snapshot.latest_close > 0;

  const isPercentMode = !hasLivePrice;
  const basePrice = hasLivePrice ? snapshot!.latest_close : 0;

  // ATR-Schrittweite (oder 0.8 % Standard-Spanne, bzw. % im Vorschaumodus)
  const atrStep = hasLivePrice
    ? snapshot?.atr14 && snapshot.atr14 > 0
      ? snapshot.atr14 * 0.55
      : basePrice * 0.008
    : 0.8;

  const hasValidLongSetup =
    scenarioBias === 'long' &&
    setup?.direction === 'Long (Dip-Szenario)' &&
    typeof setup.entry_price === 'number' &&
    typeof setup.stop_loss_price === 'number' &&
    typeof setup.take_profit_1_price === 'number' &&
    setup.stop_loss_price < setup.entry_price &&
    setup.entry_price < setup.take_profit_1_price;

  const hasValidShortSetup =
    scenarioBias === 'short' &&
    setup?.direction === 'Short (Rücksetzer-Szenario)' &&
    typeof setup.entry_price === 'number' &&
    typeof setup.stop_loss_price === 'number' &&
    typeof setup.take_profit_1_price === 'number' &&
    setup.stop_loss_price > setup.entry_price &&
    setup.entry_price > setup.take_profit_1_price;

  let entryPrice: number;
  let stopLossPrice: number;
  let tp1Price: number;
  let tp2Price: number;
  let usingKiLevels = false;

  if (hasValidLongSetup && setup) {
    usingKiLevels = true;
    entryPrice = setup.entry_price!;
    stopLossPrice = setup.stop_loss_price!;
    tp1Price = setup.take_profit_1_price!;
    tp2Price =
      typeof setup.take_profit_2_price === 'number' && setup.take_profit_2_price > tp1Price
        ? setup.take_profit_2_price
        : tp1Price + (tp1Price - entryPrice) * 0.7;
  } else if (hasValidShortSetup && setup) {
    usingKiLevels = true;
    entryPrice = setup.entry_price!;
    stopLossPrice = setup.stop_loss_price!;
    tp1Price = setup.take_profit_1_price!;
    tp2Price =
      typeof setup.take_profit_2_price === 'number' && setup.take_profit_2_price < tp1Price
        ? setup.take_profit_2_price
        : tp1Price - (entryPrice - tp1Price) * 0.7;
  } else if (scenarioBias === 'long') {
    if (isPercentMode) {
      entryPrice = -0.45;
      stopLossPrice = -0.95;
      tp1Price = 0.85;
      tp2Price = 1.55;
    } else {
      const vwapAnchor = snapshot?.intraday_1d?.intraday_vwap;
      entryPrice =
        vwapAnchor && vwapAnchor < basePrice && basePrice - vwapAnchor < atrStep * 1.4
          ? vwapAnchor
          : basePrice - atrStep * 0.55;
      stopLossPrice = entryPrice - atrStep * 0.75;
      tp1Price = entryPrice + atrStep * 1.35;
      tp2Price = entryPrice + atrStep * 2.25;
    }
  } else {
    if (isPercentMode) {
      entryPrice = 0.45;
      stopLossPrice = 0.95;
      tp1Price = -0.85;
      tp2Price = -1.55;
    } else {
      const r1Anchor = snapshot?.pivot_points?.r1;
      entryPrice =
        r1Anchor && r1Anchor > basePrice && r1Anchor - basePrice < atrStep * 1.6
          ? r1Anchor
          : basePrice + atrStep * 0.55;
      stopLossPrice = entryPrice + atrStep * 0.75;
      tp1Price = entryPrice - atrStep * 1.35;
      tp2Price = entryPrice - atrStep * 2.25;
    }
  }

  const openSpike =
    scenarioBias === 'long'
      ? isPercentMode
        ? 0.15
        : basePrice + atrStep * 0.18
      : isPercentMode
        ? -0.15
        : basePrice - atrStep * 0.18;

  const reclaimMid =
    scenarioBias === 'long'
      ? entryPrice + (tp1Price - entryPrice) * 0.45
      : entryPrice - (entryPrice - tp1Price) * 0.45;

  const points: PhasePoint[] =
    scenarioBias === 'long'
      ? [
          {
            label: timeLabels[0],
            price: isPercentMode ? 0 : basePrice,
            invalidationPrice: isPercentMode ? 0 : basePrice,
            note: 'Vorbörsliche Referenz vor Eröffnungsauktion',
          },
          {
            label: timeLabels[1],
            price: openSpike,
            invalidationPrice: openSpike,
            note: 'Erster Eröffnungsimpuls & erhöhte Spread-Volatilität',
          },
          {
            label: timeLabels[2],
            price: entryPrice,
            invalidationPrice: entryPrice,
            note: 'Typischer Rücksetzer / Sweep in die Einstiegszone',
          },
          {
            label: timeLabels[3],
            price: reclaimMid,
            invalidationPrice: stopLossPrice,
            note: 'Reaktion / VWAP-Rückeroberung bestätigt Käufer (bei Bruch unter SL: Invalidation)',
          },
          {
            label: timeLabels[4],
            price: tp1Price,
            invalidationPrice: stopLossPrice - (entryPrice - stopLossPrice) * 0.25,
            note: 'Trend-Fortsetzung Richtung Teilgewinn TP1',
          },
          {
            label: timeLabels[5],
            price: tp2Price,
            invalidationPrice: stopLossPrice - (entryPrice - stopLossPrice) * 0.4,
            note: 'Erweitertes Tagesziel TP2 bei anhaltendem Momentum',
          },
        ]
      : [
          {
            label: timeLabels[0],
            price: isPercentMode ? 0 : basePrice,
            invalidationPrice: isPercentMode ? 0 : basePrice,
            note: 'Vorbörsliche Referenz vor Eröffnungsauktion',
          },
          {
            label: timeLabels[1],
            price: openSpike,
            invalidationPrice: openSpike,
            note: 'Kurzer Eröffnungstest nach unten vor Gegenbewegung',
          },
          {
            label: timeLabels[2],
            price: entryPrice,
            invalidationPrice: entryPrice,
            note: 'Hochlauf in Widerstandszone (Short-Einstiegsfenster)',
          },
          {
            label: timeLabels[3],
            price: reclaimMid,
            invalidationPrice: stopLossPrice,
            note: 'Ablehnung unter VWAP / Pivot bestätigt Verkäufer (über SL: Invalidation)',
          },
          {
            label: timeLabels[4],
            price: tp1Price,
            invalidationPrice: stopLossPrice + (stopLossPrice - entryPrice) * 0.25,
            note: 'Abwärtsimpuls in Richtung TP1',
          },
          {
            label: timeLabels[5],
            price: tp2Price,
            invalidationPrice: stopLossPrice + (stopLossPrice - entryPrice) * 0.4,
            note: 'Ausdehnung bis Zielzone TP2 bei hohem Abgabedruck',
          },
        ];

  const allValues = [
    ...points.map((p) => p.price),
    ...points.slice(2).map((p) => p.invalidationPrice),
    entryPrice,
    stopLossPrice,
    tp1Price,
    tp2Price,
  ];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const span = Math.max(maxVal - minVal, 0.0001);
  const paddedMin = minVal - span * 0.14;
  const paddedMax = maxVal + span * 0.14;
  const paddedSpan = paddedMax - paddedMin;

  const width = 440;
  const height = 148;
  const leftPad = 14;
  const rightPad = 94;
  const topPad = 14;
  const bottomPad = 24;
  const plotW = width - leftPad - rightPad;
  const plotH = height - topPad - bottomPad;

  const toX = (idx: number) => leftPad + (idx / (points.length - 1)) * plotW;
  const toY = (val: number) => topPad + ((paddedMax - val) / paddedSpan) * plotH;

  const primaryPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.price).toFixed(1)}`)
    .join(' ');

  const invalidationPath = points
    .slice(2)
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${toX(i + 2).toFixed(1)} ${toY(p.invalidationPrice).toFixed(1)}`
    )
    .join(' ');

  const areaPath = `${primaryPath} L ${toX(points.length - 1).toFixed(1)} ${(topPad + plotH).toFixed(1)} L ${toX(0).toFixed(1)} ${(topPad + plotH).toFixed(1)} Z`;

  const entryX = toX(2);
  const entryY = toY(points[2].price);
  const entryBandStart = toX(1.65);
  const entryBandWidth = toX(2.45) - entryBandStart;

  const accentStroke = scenarioBias === 'long' ? '#22C55E' : '#F43F5E';
  const areaFill =
    scenarioBias === 'long' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(244, 63, 94, 0.12)';

  const rawRefLines = [
    { label: 'TP2', price: tp2Price, color: '#10B981' },
    { label: 'TP1', price: tp1Price, color: '#22C55E' },
    { label: 'Einstieg', price: entryPrice, color: '#60A5FA' },
    { label: 'SL', price: stopLossPrice, color: '#EF4444' },
  ]
    .map((line) => ({ ...line, lineY: toY(line.price), labelY: toY(line.price) }))
    .sort((a, b) => a.lineY - b.lineY);

  const minLabelGap = 11;
  for (let i = 1; i < rawRefLines.length; i++) {
    if (rawRefLines[i].labelY - rawRefLines[i - 1].labelY < minLabelGap) {
      rawRefLines[i].labelY = rawRefLines[i - 1].labelY + minLabelGap;
    }
  }
  const refLines = rawRefLines;

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[2];

  return (
    <div className="mt-2.5 rounded-lg border border-slate-800/90 bg-[#0B111E] p-2.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-slate-200 truncate">
            Theoretischer Eröffnungsverlauf (Einstiegsszenario)
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {usingKiLevels
              ? 'Skaliert auf KI-Setup-Marken (Einstieg / SL / TP)'
              : hasLivePrice
                ? 'ATR-Modell auf aktuellem Kursniveau'
                : 'Normiertes Opening-Range-Modell (%-Abstand)'}
          </div>
        </div>

        <div
          className="inline-flex rounded-md border border-slate-800 bg-[#111827] p-0.5 shrink-0"
          role="group"
          aria-label={`Eröffnungsszenario für ${assetName}`}
        >
          <button
            type="button"
            onClick={() => setScenarioBias('long')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer ${
              scenarioBias === 'long'
                ? 'bg-emerald-600/25 text-emerald-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Long-Dip
          </button>
          <button
            type="button"
            onClick={() => setScenarioBias('short')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer ${
              scenarioBias === 'short'
                ? 'bg-rose-600/25 text-rose-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Short-Test
          </button>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block select-none"
        role="img"
        aria-label={`Theoretischer Eröffnungs-Chart für ${assetName}`}
      >
        {/* Einstiegsfenster-Markierung (+15m nach Open) */}
        <rect
          x={entryBandStart}
          y={topPad}
          width={entryBandWidth}
          height={plotH}
          fill="rgba(59, 130, 246, 0.08)"
        />
        <text
          x={entryBandStart + entryBandWidth / 2}
          y={topPad + 9}
          textAnchor="middle"
          fill="#93C5FD"
          fontSize="8.5"
          fontFamily="DM Sans, sans-serif"
        >
          Einstiegsfenster
        </text>

        {/* Horizontale Preislinien & rechte Labels */}
        {refLines.map((line) => (
          <g key={line.label}>
            <line
              x1={leftPad}
              y1={line.lineY}
              x2={leftPad + plotW}
              y2={line.lineY}
              stroke={line.color}
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={leftPad + plotW + 5}
              y={Math.min(line.labelY + 3, height - bottomPad - 2)}
              fill={line.color}
              fontSize="8.5"
              fontFamily="JetBrains Mono, monospace"
            >
              {line.label} {formatAxisLevel(line.price, isPercentMode)}
            </text>
          </g>
        ))}

        {/* Gefüllte Fläche & Hauptpfad */}
        <path d={areaPath} fill={areaFill} />
        <path
          d={invalidationPath}
          fill="none"
          stroke="#EF4444"
          strokeWidth={1.3}
          strokeDasharray="3 3"
          strokeOpacity={0.7}
        />
        <path
          d={primaryPath}
          fill="none"
          stroke={accentStroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interaktive Phasen-Punkte */}
        {points.map((pt, idx) => {
          const cx = toX(idx);
          const cy = toY(pt.price);
          const isEntry = idx === 2;
          const isHovered = hoveredIdx === idx;
          return (
            <g
              key={pt.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <line
                x1={cx}
                y1={topPad}
                x2={cx}
                y2={topPad + plotH}
                stroke="#1E293B"
                strokeWidth={0.75}
                strokeOpacity={0.5}
              />
              <circle
                cx={cx}
                cy={cy}
                r={isEntry ? 4.2 : isHovered ? 3.8 : 2.5}
                fill={isEntry ? '#3B82F6' : accentStroke}
                stroke="#0B111E"
                strokeWidth={1.2}
              />
              <text
                x={cx}
                y={height - 6}
                textAnchor="middle"
                fill={isEntry || isHovered ? '#E2E8F0' : '#64748B'}
                fontSize="8.5"
                fontFamily="JetBrains Mono, monospace"
              >
                {pt.label}
              </text>
            </g>
          );
        })}

        {/* Einstieg-Markierung direkt am Punkt */}
        <text
          x={entryX}
          y={scenarioBias === 'long' ? entryY + 13 : entryY - 7}
          textAnchor="middle"
          fill="#93C5FD"
          fontSize="8.5"
          fontWeight="600"
          fontFamily="DM Sans, sans-serif"
        >
          Einstieg
        </text>
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/70 pt-1.5 text-[10px] text-slate-400">
        <span className="truncate">
          <strong className="font-mono-num text-slate-200">{activePoint.label}:</strong>{' '}
          {activePoint.note}
        </span>
        <span className="text-slate-500 shrink-0">Nur theoretisches Modell</span>
      </div>
    </div>
  );
}
