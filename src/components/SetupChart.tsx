import { memo, useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { OhlcCandle, TradeSetupIdea } from '../types/research';

interface SetupChartProps {
  assetName: string;
  height: number;
  candles?: OhlcCandle[];
  vwap?: number | null;
  pivotPp?: number | null;
  setup?: TradeSetupIdea;
}

export const SetupChart = memo(function SetupChart({
  assetName,
  height,
  candles,
  vwap,
  pivotPp,
  setup,
}: SetupChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fetchedCandles, setFetchedCandles] = useState<OhlcCandle[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeCandles = candles && candles.length > 0 ? candles : fetchedCandles;

  useEffect(() => {
    if (candles && candles.length > 0) return;

    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    fetch(`/api/candles?asset=${encodeURIComponent(assetName)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setFetchedCandles(Array.isArray(data?.candles) ? data.candles : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Kerzen nicht verfügbar.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assetName, candles]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || activeCandles.length === 0) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0E1525' },
        textColor: '#94A3B8',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
      },
      rightPriceScale: {
        borderColor: '#1E293B',
      },
      timeScale: {
        borderColor: '#1E293B',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderUpColor: '#22C55E',
      borderDownColor: '#EF4444',
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    });

    // Sicherstellen, dass Zeitstempel streng aufsteigend & dedupliziert sind
    const seenTimes = new Set<number>();
    const formatted = activeCandles
      .filter((c) => {
        if (seenTimes.has(c.time)) return false;
        seenTimes.add(c.time);
        return true;
      })
      .sort((a, b) => a.time - b.time)
      .map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

    series.setData(formatted);

    const addLine = (
      price: number | null | undefined,
      title: string,
      color: string,
      style: LineStyle
    ) => {
      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return;
      series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: style,
        axisLabelVisible: true,
        title,
      });
    };

    if (typeof vwap === 'number') addLine(vwap, 'VWAP', '#F59E0B', LineStyle.Dotted);
    if (typeof pivotPp === 'number') addLine(pivotPp, 'PP', '#64748B', LineStyle.Dotted);

    if (setup && setup.direction !== 'Abwarten (Kein klares Setup)') {
      addLine(setup.entry_price, 'Einstieg', '#3B82F6', LineStyle.Dashed);
      addLine(setup.stop_loss_price, 'SL', '#EF4444', LineStyle.Dashed);
      addLine(setup.take_profit_1_price, 'TP1', '#22C55E', LineStyle.Dashed);
      addLine(setup.take_profit_2_price, 'TP2', '#10B981', LineStyle.Solid);
    }

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          chart.applyOptions({ width: entry.contentRect.width, height });
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [activeCandles, height, vwap, pivotPp, setup]);

  return (
    <div
      style={{ height: `${height}px` }}
      className="relative w-full overflow-hidden rounded-lg bg-[#0E1525]"
    >
      <div ref={containerRef} className="h-full w-full" />

      {loading && activeCandles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0E1525]/85 text-xs text-slate-400">
          Lade 15m-Kerzen &amp; Preislinien für {assetName} …
        </div>
      )}

      {!loading && errorMsg && activeCandles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-rose-400">
          {errorMsg}
        </div>
      )}
    </div>
  );
});
