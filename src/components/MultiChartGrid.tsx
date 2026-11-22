import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Columns2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type {
  AssetConfig,
  ChartTimeframeKey,
  MarketResearchAssetAnalysis,
  MarketSnapshot,
  ResearchApiResponse,
} from '../types/research';
import {
  computePositionSizing,
  formatCompactUsd,
  formatNum,
  formatPct,
  formatUtcDate,
  getExchangeSessionStatuses,
} from '../utils/formatters';
import { SetupChart } from './SetupChart';
import { TheoreticalOpenChart } from './TheoreticalOpenChart';
import { TradingViewWidget } from './TradingViewWidget';

interface MultiChartGridProps {
  assetsMeta: Record<string, AssetConfig>;
  selectedAssets: string[];
  report: ResearchApiResponse | null;
  isLoading: boolean;
  accountSize: number;
  riskPerTradePct: number;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onStartResearch: () => void;
  onOpenReport: () => void;
}

type ChartMode = 'tradingview' | 'setup';

const TIMEFRAME_OPTIONS: Array<{ key: ChartTimeframeKey; label: string }> = [
  { key: '1D', label: '1 Tag (15m)' },
  { key: '5D', label: '5 Tage (1h)' },
  { key: '1M', label: '1 Monat (4h)' },
  { key: '6M', label: '6 Monate (1D)' },
];

const BIAS_STYLES: Record<string, string> = {
  bullish: 'text-emerald-400',
  bearish: 'text-rose-400',
  neutral: 'text-slate-300',
  gemischt: 'text-amber-300',
};

const DIRECTION_STYLES: Record<string, string> = {
  'Long (Dip-Szenario)': 'text-emerald-400',
  'Short (Rücksetzer-Szenario)': 'text-rose-400',
  'Abwarten (Kein klares Setup)': 'text-amber-300',
};

export function MultiChartGrid({
  assetsMeta,
  selectedAssets,
  report,
  isLoading,
  accountSize,
  riskPerTradePct,
  sidebarCollapsed,
  onToggleSidebar,
  onStartResearch,
  onOpenReport,
}: MultiChartGridProps) {
  const [cols, setCols] = useState<1 | 2 | 3 | 4>(3);
  const [chartHeight, setChartHeight] = useState<number>(380);
  const [timeframe, setTimeframe] = useState<ChartTimeframeKey>('1D');
  const [chartMode, setChartMode] = useState<ChartMode>('tradingview');
  const [hiddenCharts, setHiddenCharts] = useState<string[]>([]);
  const [summaryOpen, setSummaryOpen] = useState<boolean>(true);
  const [sortByScanner, setSortByScanner] = useState<boolean>(false);
  const [showTheoreticalCharts, setShowTheoreticalCharts] = useState<boolean>(true);
  const [sessions, setSessions] = useState(() => getExchangeSessionStatuses());

  useEffect(() => {
    const timer = setInterval(() => {
      setSessions(getExchangeSessionStatuses());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const activeSelection = selectedAssets.length > 0 ? selectedAssets : Object.keys(assetsMeta);

  const marketByName = new Map<string, MarketSnapshot>(
    (report?.market_data || []).map((item) => [item.name, item])
  );
  const analysisByName = new Map<string, MarketResearchAssetAnalysis>(
    (report?.analysis?.assets || []).map((item) => [item.name, item])
  );

  const orderedSelection = sortByScanner && report
    ? [...activeSelection].sort((a, b) => {
        const sa = marketByName.get(a)?.scanner_score?.total ?? -1;
        const sb = marketByName.get(b)?.scanner_score?.total ?? -1;
        return sb - sa;
      })
    : activeSelection;

  const visibleAssets = orderedSelection.filter((name) => !hiddenCharts.includes(name));

  const toggleChartVisibility = (name: string) => {
    setHiddenCharts((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const gridColsClass =
    cols === 1
      ? 'grid-cols-1'
      : cols === 2
        ? 'grid-cols-1 xl:grid-cols-2'
        : cols === 3
          ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4';

  const rankedScanner = (report?.market_data || [])
    .slice()
    .sort((a, b) => b.scanner_score.total - a.scanner_score.total);

  return (
    <div className="space-y-4">
      {/* Live Börsen-Sessions & Countdown */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-slate-800 bg-[#111827] px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {sessions.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">{s.label}:</span>
              <span
                className={`font-mono-num ${
                  s.isOpen ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {s.stateText}
              </span>
            </div>
          ))}
        </div>

        {report?.macro_sentiment && (
          <div className="text-slate-300 font-mono-num">
            Fear &amp; Greed:{' '}
            <span className="font-semibold text-amber-300">
              {report.macro_sentiment.value}/100 ({report.macro_sentiment.classification})
            </span>
          </div>
        )}
      </div>

      {/* Chart-Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#111827] px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0B111E] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 hover:border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {sidebarCollapsed ? (
              <>
                <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Auftrag einblenden
              </>
            ) : (
              <>
                <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
                Vollbreite
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 whitespace-nowrap">Ansicht</span>
            <div
              className="inline-flex rounded-lg border border-slate-800 bg-[#0B111E] p-0.5"
              role="group"
              aria-label="Chart-Modus"
            >
              <button
                type="button"
                onClick={() => setChartMode('tradingview')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chartMode === 'tradingview'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                TradingView
              </button>
              <button
                type="button"
                onClick={() => setChartMode('setup')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chartMode === 'setup'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Setup-Linien (SL/TP)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
              Spalten
            </span>
            <div
              className="inline-flex rounded-lg border border-slate-800 bg-[#0B111E] p-0.5"
              role="group"
              aria-label="Anzahl der Chart-Spalten"
            >
              {([1, 2, 3, 4] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setCols(count)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    cols === count
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {chartMode === 'tradingview' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                Intervall
              </span>
              <div
                className="inline-flex rounded-lg border border-slate-800 bg-[#0B111E] p-0.5"
                role="group"
                aria-label="Chart-Zeitfenster"
              >
                {TIMEFRAME_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setTimeframe(opt.key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      timeframe === opt.key
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2.5 text-xs font-medium text-slate-400">
            <span className="whitespace-nowrap">
              Höhe{' '}
              <span className="font-mono-num text-slate-200">{chartHeight} px</span>
            </span>
            <input
              type="range"
              min={300}
              max={640}
              step={20}
              value={chartHeight}
              onChange={(e) => setChartHeight(Number(e.target.value))}
              className="w-24 accent-blue-600 cursor-pointer"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowTheoreticalCharts((prev) => !prev)}
            aria-pressed={showTheoreticalCharts}
            className={`mr-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showTheoreticalCharts
                ? 'border-blue-500/50 bg-blue-600/15 text-blue-200'
                : 'border-slate-800 bg-[#0B111E] text-slate-400 hover:text-slate-200'
            }`}
          >
            Eröffnungs-Modell
          </button>
          {report && (
            <button
              type="button"
              onClick={() => setSortByScanner((prev) => !prev)}
              className={`mr-2 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sortByScanner
                  ? 'border-emerald-500/50 bg-emerald-600/15 text-emerald-300'
                  : 'border-slate-800 bg-[#0B111E] text-slate-400 hover:text-slate-200'
              }`}
            >
              Nach Scanner sortieren
            </button>
          )}
          <span className="mr-1 text-xs font-medium text-slate-400">
            Charts ({visibleAssets.length}/{activeSelection.length}):
          </span>
          {orderedSelection.map((name) => {
            const isVisible = !hiddenCharts.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleChartVisibility(name)}
                aria-pressed={isVisible}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isVisible
                    ? 'border-blue-500/50 bg-blue-600/15 text-blue-200'
                    : 'border-slate-800 bg-[#0B111E] text-slate-500 hover:text-slate-300'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scanner-Ranking & Börseneröffnungs-Überblick */}
      {rankedScanner.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-[#111827] px-4 py-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-200">
              Setup-Scanner (technische Struktur-Bewertung)
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono-num">
              {rankedScanner.slice(0, 6).map((item, idx) => (
                <span key={item.name} className="text-slate-300">
                  {idx + 1}. {item.name}:{' '}
                  <strong
                    className={
                      item.scanner_score.total >= 70
                        ? 'text-emerald-400'
                        : item.scanner_score.total >= 50
                          ? 'text-amber-300'
                          : 'text-slate-400'
                    }
                  >
                    {item.scanner_score.total}/100
                  </strong>
                </span>
              ))}
            </div>
          </div>

          {report?.analysis?.market_open_overview && (
            <div className="border-t border-slate-800/80 pt-2.5">
              <button
                type="button"
                onClick={() => setSummaryOpen((prev) => !prev)}
                aria-expanded={summaryOpen}
                className="flex w-full items-center justify-between gap-4 text-left text-xs font-semibold text-slate-100 cursor-pointer"
              >
                <span>Markt-Überblick für die nächste Börseneröffnung</span>
                {summaryOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                )}
              </button>
              {summaryOpen && (
                <div className="mt-2 space-y-2 text-xs text-slate-300 leading-relaxed">
                  <p>{report.analysis.market_open_overview}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span>{report.analysis.disclaimer}</span>
                    <button
                      type="button"
                      onClick={onOpenReport}
                      className="text-blue-400 hover:text-blue-300 font-medium underline underline-offset-4 cursor-pointer whitespace-nowrap"
                    >
                      Vollständigen Multi-Quellen-Bericht öffnen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {visibleAssets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-[#111827] px-6 py-12 text-center">
          <p className="text-sm text-slate-300">
            Alle Charts sind aktuell ausgeblendet.
          </p>
          <button
            type="button"
            onClick={() => setHiddenCharts([])}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors cursor-pointer"
          >
            Alle Charts wieder einblenden
          </button>
        </div>
      ) : (
        <div className={`grid gap-4 ${gridColsClass}`}>
          {visibleAssets.map((name) => {
            const meta = assetsMeta[name];
            if (!meta) return null;
            const snapshot = marketByName.get(name);
            const assetAnalysis = analysisByName.get(name);
            const openOutlook = assetAnalysis?.next_day_open_outlook;
            const setup = assetAnalysis?.trade_setup_idea;
            const sizing = computePositionSizing(
              accountSize,
              riskPerTradePct,
              setup?.entry_price,
              setup?.stop_loss_price
            );

            return (
              <article
                key={name}
                className="flex flex-col rounded-xl border border-slate-800 bg-[#111827] p-3.5"
              >
                <div className="mb-2.5 flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-100 truncate">
                      {name}
                      {snapshot && (
                        <span className="ml-2 font-mono-num text-xs font-normal text-slate-400">
                          Scanner {snapshot.scanner_score.total}/100
                        </span>
                      )}
                    </h2>
                    {snapshot && (
                      <p className="text-[11px] text-slate-400 truncate">
                        {snapshot.trend_regime}
                      </p>
                    )}
                  </div>
                  <span className="font-mono-num text-[11px] text-slate-400 shrink-0">
                    {meta.tradingview}
                  </span>
                </div>

                {chartMode === 'setup' ? (
                  <SetupChart
                    assetName={name}
                    height={chartHeight}
                    candles={snapshot?.intraday_candles}
                    vwap={snapshot?.intraday_1d?.intraday_vwap}
                    pivotPp={snapshot?.pivot_points?.pp}
                    setup={setup}
                  />
                ) : (
                  <TradingViewWidget
                    symbol={meta.tradingview}
                    height={chartHeight}
                    timeframe={timeframe}
                  />
                )}

                {showTheoreticalCharts && (
                  <TheoreticalOpenChart
                    assetName={name}
                    category={meta.category}
                    snapshot={snapshot}
                    setup={setup}
                  />
                )}

                <div className="mt-3 border-t border-slate-800/80 pt-3 space-y-3">
                  {isLoading && !snapshot ? (
                    <div className="grid grid-cols-3 gap-2 animate-pulse">
                      <div className="h-9 rounded bg-slate-800/70" />
                      <div className="h-9 rounded bg-slate-800/70" />
                      <div className="h-9 rounded bg-slate-800/70" />
                    </div>
                  ) : snapshot ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
                        <div>
                          <div className="text-[11px] text-slate-400">Aktuell</div>
                          <div className="font-mono-num text-xs font-semibold text-slate-100">
                            {formatNum(snapshot.latest_close, 2)} {snapshot.currency}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">1T-Intraday</div>
                          <div
                            className={`font-mono-num text-xs font-semibold ${
                              (snapshot.intraday_1d?.intraday_change_pct ?? snapshot.daily_change_pct) >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {formatPct(
                              snapshot.intraday_1d?.intraday_change_pct ?? snapshot.daily_change_pct
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">ATR(14) / ±1σ</div>
                          <div className="font-mono-num text-xs font-semibold text-slate-100">
                            {snapshot.atr14_pct !== null ? `${formatNum(snapshot.atr14_pct, 2)} %` : '–'}
                            <span className="text-slate-500"> / </span>
                            {formatNum(snapshot.expected_daily_move_pct, 2)} %
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">RSI (14)</div>
                          <div className="font-mono-num text-xs font-semibold text-slate-100">
                            {snapshot.rsi14 !== null ? formatNum(snapshot.rsi14, 1) : '–'}
                          </div>
                        </div>
                      </div>

                      {snapshot.intraday_1d && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400 font-mono-num">
                          <span>1T ({snapshot.intraday_1d.session_date})</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {formatNum(snapshot.intraday_1d.day_low, 2)} –{' '}
                            {formatNum(snapshot.intraday_1d.day_high, 2)}
                          </span>
                          {snapshot.intraday_1d.intraday_vwap !== null && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>VWAP {formatNum(snapshot.intraday_1d.intraday_vwap, 2)}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>Stand {formatUtcDate(snapshot.as_of)}</span>
                        </div>
                      )}

                      {snapshot.derivatives && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-300 font-mono-num">
                          <span>
                            Funding:{' '}
                            <strong
                              className={
                                (snapshot.derivatives.funding_rate_pct ?? 0) > 0.02
                                  ? 'text-amber-300'
                                  : (snapshot.derivatives.funding_rate_pct ?? 0) < -0.01
                                    ? 'text-emerald-400'
                                    : 'text-slate-100'
                              }
                            >
                              {snapshot.derivatives.funding_rate_pct !== null
                                ? `${snapshot.derivatives.funding_rate_pct} %`
                                : '–'}
                            </strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            OI: {formatCompactUsd(snapshot.derivatives.open_interest_usd)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400">{snapshot.derivatives.source}</span>
                        </div>
                      )}

                      {setup && (
                        <div className="border-t border-slate-800/70 pt-2.5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span
                              className={`font-semibold ${
                                DIRECTION_STYLES[setup.direction] || 'text-slate-200'
                              }`}
                            >
                              {setup.direction}
                            </span>
                            <span className="font-mono-num text-[11px] text-slate-300">
                              CRV {setup.risk_reward_ratio}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                            <div>
                              <span className="text-slate-400">Einstieg: </span>
                              <span className="font-mono-num text-slate-100">{setup.entry_zone}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Stop-Loss: </span>
                              <span className="font-mono-num text-rose-400">{setup.stop_loss}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">TP 1: </span>
                              <span className="font-mono-num text-emerald-400">{setup.take_profit_1}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">TP 2: </span>
                              <span className="font-mono-num text-emerald-400">{setup.take_profit_2}</span>
                            </div>
                          </div>

                          {sizing && (
                            <div className="text-[11px] text-slate-300 font-mono-num">
                              Positionsgröße ({riskPerTradePct}% = {formatNum(sizing.riskAmount, 0)}):{' '}
                              <strong className="text-slate-100">{sizing.units} Stk.</strong>{' '}
                              <span className="text-slate-400">
                                (Wert {formatNum(sizing.positionValue, 0)} · SL-Abstand{' '}
                                {sizing.stopDistancePct}%)
                              </span>
                            </div>
                          )}

                          {assetAnalysis?.dip_and_movement_tips?.[0] && (
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              <span className="font-semibold text-slate-200">Dip-/Markt-Tipp: </span>
                              {assetAnalysis.dip_and_movement_tips[0]}
                            </p>
                          )}
                        </div>
                      )}

                      {openOutlook && (
                        <div className="border-t border-slate-800/70 pt-2.5 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span
                              className={`font-semibold capitalize ${
                                BIAS_STYLES[openOutlook.bias] || 'text-slate-200'
                              }`}
                            >
                              Eröffnung: {openOutlook.bias} (Konfidenz {openOutlook.confidence})
                            </span>
                            <span className="font-mono-num text-[11px] text-slate-400">
                              {openOutlook.sources_used_count} Quellen
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {openOutlook.expected_open_scenario}
                          </p>
                          {openOutlook.news_impact_summary && (
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              <span className="font-semibold text-slate-300">News-Treiber: </span>
                              {openOutlook.news_impact_summary}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span>
                        {report
                          ? 'Keine Marktdaten für diesen Markt im aktuellen Bericht.'
                          : 'Starte Deep Research für Scanner-Score, Setups, Derivate & Eröffnungsprognose.'}
                      </span>
                      {!report && (
                        <button
                          type="button"
                          onClick={onStartResearch}
                          className="text-blue-400 hover:text-blue-300 font-medium underline underline-offset-4 cursor-pointer"
                        >
                          Analysieren
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Im Modus „Setup-Linien (SL/TP)“ werden Einstieg, Stop-Loss, TP1, TP2, VWAP und Pivot direkt auf 15m-Kerzen gezeichnet. Alle Szenarien dienen nur zu Research- und Lernzwecken.
      </p>
    </div>
  );
}
