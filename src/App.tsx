import { useEffect, useState } from 'react';
import { Headphones, Loader2, Search } from 'lucide-react';
import { MultiChartGrid } from './components/MultiChartGrid';
import { ResearchJournal } from './components/ResearchJournal';
import { ResearchReport } from './components/ResearchReport';
import { UsOpenVoiceDesk } from './components/UsOpenVoiceDesk';
import type {
  AppConfigResponse,
  AssetCategoryKey,
  AssetConfig,
  JournalEntry,
  PeriodKey,
  ResearchApiResponse,
  SetupFocusKey,
  SetupVerificationResult,
  TradingStyleKey,
  VoiceNameKey,
} from './types/research';

const JOURNAL_STORAGE_KEY = 'trading-deep-research-journal-v1';

const DEFAULT_ASSETS: Record<string, AssetConfig> = {
  'Bitcoin': {
    ticker: 'BTC-USD',
    tradingview: 'COINBASE:BTCUSD',
    search: 'Bitcoin BTC market outlook risks',
    tradingDays: 365,
    category: 'krypto',
    defaultSelected: true,
    krakenFuturesSymbol: 'PF_XBTUSD',
  },
  'Ethereum': {
    ticker: 'ETH-USD',
    tradingview: 'COINBASE:ETHUSD',
    search: 'Ethereum ETH market outlook risks',
    tradingDays: 365,
    category: 'krypto',
    defaultSelected: true,
    krakenFuturesSymbol: 'PF_ETHUSD',
  },
  'Solana': {
    ticker: 'SOL-USD',
    tradingview: 'COINBASE:SOLUSD',
    search: 'Solana SOL crypto outlook risks',
    tradingDays: 365,
    category: 'krypto',
    defaultSelected: false,
    krakenFuturesSymbol: 'PF_SOLUSD',
  },
  'S&P 500': {
    ticker: '^GSPC',
    tradingview: 'SP:SPX',
    search: 'S&P 500 SPX market outlook risks',
    tradingDays: 252,
    category: 'indizes_fx',
    defaultSelected: true,
  },
  'Nasdaq 100': {
    ticker: '^NDX',
    tradingview: 'NASDAQ:NDX',
    search: 'Nasdaq 100 tech stocks outlook risks',
    tradingDays: 252,
    category: 'indizes_fx',
    defaultSelected: true,
  },
  'DAX 40': {
    ticker: '^GDAXI',
    tradingview: 'TVC:DEU40',
    search: 'DAX 40 Aktienmarkt Ausblick Risiken',
    tradingDays: 252,
    category: 'indizes_fx',
    defaultSelected: true,
  },
  'EUR/USD': {
    ticker: 'EURUSD=X',
    tradingview: 'FX:EURUSD',
    search: 'EUR USD forex outlook ECB Fed',
    tradingDays: 252,
    category: 'indizes_fx',
    defaultSelected: false,
  },
  'Gold': {
    ticker: 'GC=F',
    tradingview: 'TVC:GOLD',
    search: 'gold price market outlook risks',
    tradingDays: 252,
    category: 'rohstoffe',
    defaultSelected: true,
  },
  'Silber': {
    ticker: 'SI=F',
    tradingview: 'TVC:SILVER',
    search: 'silver price market outlook industrial demand',
    tradingDays: 252,
    category: 'rohstoffe',
    defaultSelected: false,
  },
  'WTI Rohöl': {
    ticker: 'CL=F',
    tradingview: 'TVC:USOIL',
    search: 'WTI crude oil price outlook OPEC',
    tradingDays: 252,
    category: 'rohstoffe',
    defaultSelected: false,
  },
};

const DEFAULT_PERIODS: Record<PeriodKey, string> = {
  '3mo': '3 Monate',
  '6mo': '6 Monate',
  '1y': '1 Jahr',
  '2y': '2 Jahre',
};

const CATEGORY_LABELS: Record<AssetCategoryKey, string> = {
  krypto: 'Krypto',
  indizes_fx: 'Indizes & FX',
  rohstoffe: 'Rohstoffe',
};

type ActiveView = 'charts' | 'voice' | 'report' | 'journal';

function getDefaultSelection(assets: Record<string, AssetConfig>): string[] {
  const defaults = Object.entries(assets)
    .filter(([, cfg]) => cfg.defaultSelected !== false)
    .map(([name]) => name);
  return defaults.length >= 6 ? defaults : Object.keys(assets).slice(0, 6);
}

function loadSavedJournal(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [assetsMeta, setAssetsMeta] = useState<Record<string, AssetConfig>>(DEFAULT_ASSETS);
  const [periodsMeta, setPeriodsMeta] = useState<Record<PeriodKey, string>>(DEFAULT_PERIODS);
  const [selectedAssets, setSelectedAssets] = useState<string[]>(() =>
    getDefaultSelection(DEFAULT_ASSETS)
  );
  const [query, setQuery] = useState<string>('Börseneröffnung Dips Risiken');
  const [period, setPeriod] = useState<PeriodKey>('6mo');
  const [tradingStyle, setTradingStyle] = useState<TradingStyleKey>('intraday');
  const [setupFocus, setSetupFocus] = useState<SetupFocusKey>('both');
  const [riskPerTradePct, setRiskPerTradePct] = useState<number>(1.0);
  const [accountSize, setAccountSize] = useState<number>(10000);
  const [activeView, setActiveView] = useState<ActiveView>('charts');
  const [voice, setVoice] = useState<VoiceNameKey>('Charon');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const [report, setReport] = useState<ResearchApiResponse | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>(() => loadSavedJournal());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AppConfigResponse | null) => {
        if (cancelled || !data) return;
        if (data.assets && Object.keys(data.assets).length > 0) {
          setAssetsMeta(data.assets);
          setSelectedAssets(getDefaultSelection(data.assets));
        }
        if (data.periods) {
          setPeriodsMeta(data.periods);
        }
      })
      .catch(() => {
        // Standard-Konfiguration bleibt aktiv
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistJournal = (next: JournalEntry[]) => {
    setJournal(next);
    try {
      // Ohne schwere intraday_candles-Arrays speichern, um localStorage schlank zu halten
      const compact = next.slice(0, 20).map((entry) => ({
        ...entry,
        report: {
          ...entry.report,
          market_data: entry.report.market_data.map((m) => ({
            ...m,
            intraday_candles: [],
          })),
        },
      }));
      localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // Speicher voll oder blockiert
    }
  };

  const toggleAsset = (name: string) => {
    setSelectedAssets((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const applyWatchlistPreset = (preset: 'default6' | 'crypto' | 'all') => {
    if (preset === 'default6') {
      setSelectedAssets(getDefaultSelection(assetsMeta));
    } else if (preset === 'crypto') {
      setSelectedAssets(
        Object.entries(assetsMeta)
          .filter(([, cfg]) => cfg.category === 'krypto')
          .map(([name]) => name)
      );
    } else {
      setSelectedAssets(Object.keys(assetsMeta));
    }
  };

  const handleRunResearch = async () => {
    if (selectedAssets.length === 0) {
      setErrorMsg('Bitte mindestens einen Markt auswählen.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets: selectedAssets,
          query,
          period,
          tradingStyle,
          setupFocus,
          riskPerTradePct,
          accountSize,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `Anfrage fehlgeschlagen (HTTP ${response.status})`);
      }

      const nextReport = payload as ResearchApiResponse;
      setReport(nextReport);

      const newEntry: JournalEntry = {
        id: `${nextReport.created_at}-${Math.random().toString(36).slice(2, 7)}`,
        report: nextReport,
      };
      persistJournal([newEntry, ...journal].slice(0, 20));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler bei der Recherche.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateVerifications = (
    entryId: string,
    verifications: SetupVerificationResult[],
    verifiedAt: string
  ) => {
    const next = journal.map((entry) =>
      entry.id === entryId ? { ...entry, verifications, verified_at: verifiedAt } : entry
    );
    persistJournal(next);
  };

  const handleDeleteJournalEntry = (entryId: string) => {
    persistJournal(journal.filter((entry) => entry.id !== entryId));
  };

  const handleClearJournal = () => {
    persistJournal([]);
  };

  return (
    <div className="min-h-screen bg-[#0B111E] text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-[#111827] px-5 py-3">
        <div className="mx-auto flex max-w-[1920px] items-center justify-between gap-6">
          <a
            href="/"
            className="flex flex-col whitespace-nowrap shrink-0"
          >
            <span className="text-base font-bold tracking-tight text-slate-100">
              Kronberg Market Desk
            </span>
            <span className="text-[11px] text-slate-400">
              Marktforschung · US-Open-Briefing
            </span>
          </a>

          <nav
            className="flex items-center gap-6 text-sm font-medium overflow-x-auto"
            aria-label="Ansicht wechseln"
          >
            <button
              type="button"
              onClick={() => setActiveView('charts')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeView === 'charts'
                  ? 'border-blue-500 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Multi-Chart-Analyse
            </button>
            <button
              type="button"
              onClick={() => setActiveView('voice')}
              className={`inline-flex items-center gap-1.5 py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeView === 'voice'
                  ? 'border-blue-500 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
              US-Open &amp; News-Audio
            </button>
            <button
              type="button"
              onClick={() => setActiveView('report')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeView === 'report'
                  ? 'border-blue-500 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Research-Bericht
            </button>
            <button
              type="button"
              onClick={() => setActiveView('journal')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeView === 'journal'
                  ? 'border-blue-500 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Journal &amp; Treffer ({journal.length})
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveView('voice')}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B111E] px-3 py-2 text-xs font-medium text-slate-200 hover:border-blue-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Headphones className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
              US-Open Stimme
            </button>
            <button
              type="button"
              onClick={handleRunResearch}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Analysiere Märkte …
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  Deep Research starten
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1920px] flex-1 px-5 py-4 space-y-4">
        <div
          role="note"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200"
        >
          Nur zu Research- &amp; Lernzwecken — technische Szenarien (Einstieg, Stop-Loss, Take-Profit), Positionsgrößen und Eröffnungsprognosen stellen keine Finanzberatung dar. Marktdaten können verzögert sein.
        </div>

        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {!sidebarCollapsed && (
            <aside className="w-full lg:w-[272px] shrink-0 rounded-xl border border-slate-800 bg-[#111827] p-4 space-y-4">
              <div>
                <h1 className="text-sm font-semibold text-slate-100">Recherche &amp; Risikosteuerung</h1>
                <p className="mt-1 text-xs text-slate-400">
                  Watchlist, Setup-Fokus und Positionsgröße festlegen.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span>Watchlists ({selectedAssets.length} aktiv)</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyWatchlistPreset('default6')}
                    className="rounded-md border border-slate-800 bg-[#0B111E] px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-blue-500/50 hover:text-slate-100 transition-colors cursor-pointer"
                  >
                    6er-Mix
                  </button>
                  <button
                    type="button"
                    onClick={() => applyWatchlistPreset('crypto')}
                    className="rounded-md border border-slate-800 bg-[#0B111E] px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-blue-500/50 hover:text-slate-100 transition-colors cursor-pointer"
                  >
                    Krypto
                  </button>
                  <button
                    type="button"
                    onClick={() => applyWatchlistPreset('all')}
                    className="rounded-md border border-slate-800 bg-[#0B111E] px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-blue-500/50 hover:text-slate-100 transition-colors cursor-pointer"
                  >
                    Alle 10
                  </button>
                </div>

                <div className="space-y-3 pt-1">
                  {(['krypto', 'indizes_fx', 'rohstoffe'] as AssetCategoryKey[]).map((cat) => {
                    const entries = Object.entries(assetsMeta).filter(
                      ([, cfg]) => cfg.category === cat
                    );
                    if (entries.length === 0) return null;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="text-[11px] font-semibold text-slate-400">
                          {CATEGORY_LABELS[cat]}
                        </div>
                        {entries.map(([name, meta]) => {
                          const checked = selectedAssets.includes(name);
                          return (
                            <label
                              key={name}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                                checked
                                  ? 'border-blue-500/45 bg-blue-600/10 text-slate-100'
                                  : 'border-slate-800 bg-[#0B111E] text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleAsset(name)}
                                  className="h-3.5 w-3.5 rounded border-slate-600 accent-blue-600"
                                />
                                <span>{name}</span>
                              </span>
                              <span className="font-mono-num text-[11px] text-slate-400">
                                {meta.tradingview}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-slate-300">
                    Kontogröße (€/$)
                  </span>
                  <input
                    type="number"
                    min={100}
                    max={100000000}
                    step={500}
                    value={accountSize}
                    onChange={(e) => setAccountSize(Math.max(100, Number(e.target.value) || 10000))}
                    className="w-full rounded-lg border border-slate-800 bg-[#0B111E] px-2.5 py-2 text-xs font-mono-num text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-slate-300">
                    Risiko / Setup
                  </span>
                  <select
                    value={riskPerTradePct}
                    onChange={(e) => setRiskPerTradePct(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-[#0B111E] px-2 py-2 text-xs font-mono-num text-slate-100 focus:border-blue-500 focus:outline-none"
                  >
                    <option value={0.5}>0.5 %</option>
                    <option value={1.0}>1.0 %</option>
                    <option value={1.5}>1.5 %</option>
                    <option value={2.0}>2.0 %</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="block text-xs font-medium text-slate-300">
                  Handelsstil
                </span>
                <select
                  value={tradingStyle}
                  onChange={(e) => setTradingStyle(e.target.value as TradingStyleKey)}
                  className="w-full rounded-lg border border-slate-800 bg-[#0B111E] px-2.5 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="intraday">Intraday (1T / 15m · VWAP)</option>
                  <option value="swing">Swing-Trading (EMA21 / Pivots)</option>
                  <option value="position">Position (SMA50 / Makro)</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-slate-300">
                    Setup-Fokus
                  </span>
                  <select
                    value={setupFocus}
                    onChange={(e) => setSetupFocus(e.target.value as SetupFocusKey)}
                    className="w-full rounded-lg border border-slate-800 bg-[#0B111E] px-2 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="both">Long &amp; Short</option>
                    <option value="long_only">Nur Long (Dips)</option>
                    <option value="short_only">Nur Short</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-slate-300">
                    Zeitraum
                  </span>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as PeriodKey)}
                    className="w-full rounded-lg border border-slate-800 bg-[#0B111E] px-2 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  >
                    {(Object.entries(periodsMeta) as Array<[PeriodKey, string]>).map(
                      ([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="block text-xs font-medium text-slate-300">
                  Zusätzlicher Suchbegriff
                </span>
                <input
                  type="text"
                  maxLength={250}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="z. B. Zinsen ETF Eröffnung"
                  className="w-full rounded-lg border border-slate-800 bg-[#0B111E] px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </label>

              <button
                type="button"
                onClick={handleRunResearch}
                disabled={isLoading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {isLoading ? 'Sammle Quellen & berechne Setups …' : 'Deep Research starten'}
              </button>

              {errorMsg && (
                <p role="alert" className="text-xs text-rose-400 leading-relaxed">
                  {errorMsg}
                </p>
              )}

              {report && !isLoading && !errorMsg && (
                <p className="text-[11px] text-slate-400 font-mono-num">
                  Stand: {report.created_at.slice(11, 19)} UTC · {report.market_data.length} Märkte
                </p>
              )}
            </aside>
          )}

          <main className="min-w-0 flex-1 w-full">
            <div className={activeView === 'charts' ? 'block' : 'hidden'}>
              <MultiChartGrid
                assetsMeta={assetsMeta}
                selectedAssets={selectedAssets}
                report={report}
                isLoading={isLoading}
                accountSize={accountSize}
                riskPerTradePct={riskPerTradePct}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
                onStartResearch={handleRunResearch}
                onOpenReport={() => setActiveView('report')}
              />
            </div>

            <div className={activeView === 'voice' ? 'block' : 'hidden'}>
              <UsOpenVoiceDesk
                selectedAssets={selectedAssets}
                query={query}
                voice={voice}
                onVoiceChange={setVoice}
              />
            </div>

            <div className={activeView === 'report' ? 'block' : 'hidden'}>
              <ResearchReport
                report={report}
                isLoading={isLoading}
                voice={voice}
                onStartResearch={handleRunResearch}
              />
            </div>

            <div className={activeView === 'journal' ? 'block' : 'hidden'}>
              <ResearchJournal
                entries={journal}
                onLoadReport={(loaded) => {
                  setReport(loaded);
                  setActiveView('report');
                }}
                onUpdateVerifications={handleUpdateVerifications}
                onDeleteEntry={handleDeleteJournalEntry}
                onClearAll={handleClearJournal}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
