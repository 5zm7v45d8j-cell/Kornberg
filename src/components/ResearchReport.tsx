import { useEffect, useState } from 'react';
import { Download, ExternalLink, Loader2, Volume2 } from 'lucide-react';
import type { ResearchApiResponse, VoiceNameKey } from '../types/research';
import {
  base64ToBlobUrl,
  computePositionSizing,
  formatCompactUsd,
  formatMarkdownReport,
  formatNum,
  formatPct,
  formatUtcDate,
  safeHttpUrl,
} from '../utils/formatters';

interface ResearchReportProps {
  report: ResearchApiResponse | null;
  isLoading: boolean;
  voice: VoiceNameKey;
  onStartResearch: () => void;
}

export function ResearchReport({
  report,
  isLoading,
  voice,
  onStartResearch,
}: ResearchReportProps) {
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState<boolean>(false);
  const [ttsError, setTtsError] = useState<string | null>(null);

  useEffect(() => {
    setAudioBase64(null);
    setTtsError(null);
  }, [report?.created_at]);

  useEffect(() => {
    if (!audioBase64) {
      setAudioUrl(null);
      return;
    }
    const url = base64ToBlobUrl(audioBase64, 'audio/wav');
    setAudioUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audioBase64]);
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 rounded-xl border border-slate-800 bg-[#111827]" />
        <div className="h-56 rounded-xl border border-slate-800 bg-[#111827]" />
        <div className="h-72 rounded-xl border border-slate-800 bg-[#111827]" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 bg-[#111827] px-6 py-14 text-center">
        <h2 className="text-lg font-semibold text-slate-100">
          Noch kein Multi-Quellen-Bericht erstellt
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
          Wähle in der Seitenleiste deine Märkte, Handelsstil, Kontogröße und Risiko aus und starte Deep Research.
        </p>
        <button
          type="button"
          onClick={onStartResearch}
          className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors cursor-pointer"
        >
          Deep Research starten
        </button>
      </div>
    );
  }

  const handleDownloadMarkdown = () => {
    const md = formatMarkdownReport(report);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'market-deep-research.md';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const analysis = report.analysis;
  const cryptoDerivatives = report.market_data.filter((m) => m.derivatives !== null);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-[#111827] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              Bericht: {report.assets.join(', ')}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 font-mono-num">
              <span>Erstellt (UTC): {report.created_at}</span>
              <span aria-hidden="true">·</span>
              <span>Zeitraum: {report.period}</span>
              <span aria-hidden="true">·</span>
              <span>Stil: {report.trading_style}</span>
              <span aria-hidden="true">·</span>
              <span>
                Konto: {formatNum(report.account_size, 0)} ({report.risk_per_trade_pct} % Risiko)
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-sans">Suche: {report.query || '–'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Markdown herunterladen
          </button>
        </div>

        {report.macro_sentiment && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs text-slate-300">
            <div>
              <span className="font-semibold text-slate-100">
                {report.macro_sentiment.name}:{' '}
              </span>
              <span className="font-mono-num font-semibold text-amber-300">
                {report.macro_sentiment.value}/100 ({report.macro_sentiment.classification})
              </span>
              <span className="text-slate-400">
                {' '}
                · Stand {formatUtcDate(report.macro_sentiment.updated_at)}
              </span>
            </div>
            {safeHttpUrl(report.macro_sentiment.url) && (
              <a
                href={safeHttpUrl(report.macro_sentiment.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline"
              >
                {report.macro_sentiment.source}
              </a>
            )}
          </div>
        )}

        {report.warnings.length > 0 && (
          <div className="mt-4 space-y-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <div className="font-semibold text-amber-300">Hinweise zur Datenerhebung</div>
            <ul className="list-disc pl-4 space-y-1">
              {report.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {report.market_data.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Setup-Scanner &amp; 1-Tages-Marktstruktur (Yahoo Finance OHLCV)
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400">
                    <th className="py-2.5 pr-4 text-left font-medium">Markt</th>
                    <th className="py-2.5 px-3 text-right font-medium">Scanner</th>
                    <th className="py-2.5 px-3 text-right font-medium">Aktuell</th>
                    <th className="py-2.5 px-3 text-right font-medium">1T-Intraday</th>
                    <th className="py-2.5 px-3 text-right font-medium">VWAP (1T)</th>
                    <th className="py-2.5 px-3 text-right font-medium">ATR(14)</th>
                    <th className="py-2.5 px-3 text-right font-medium">RSI(14)</th>
                    <th className="py-2.5 px-3 text-right font-medium">Pivot S1 / PP / R1</th>
                    <th className="py-2.5 pl-3 text-left font-medium">Markt-Regime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {report.market_data.map((m) => (
                    <tr key={m.ticker} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-slate-100 whitespace-nowrap">
                        {m.name}{' '}
                        <span className="font-mono-num text-xs text-slate-400">({m.ticker})</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-semibold whitespace-nowrap">
                        <span
                          className={
                            m.scanner_score.total >= 70
                              ? 'text-emerald-400'
                              : m.scanner_score.total >= 50
                                ? 'text-amber-300'
                                : 'text-slate-400'
                          }
                        >
                          {m.scanner_score.total}/100
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-100 whitespace-nowrap">
                        {formatNum(m.latest_close, 2)} {m.currency}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono-num whitespace-nowrap ${
                          (m.intraday_1d?.intraday_change_pct ?? m.daily_change_pct) >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {formatPct(m.intraday_1d?.intraday_change_pct ?? m.daily_change_pct)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-200 whitespace-nowrap">
                        {m.intraday_1d?.intraday_vwap !== null &&
                        m.intraday_1d?.intraday_vwap !== undefined
                          ? formatNum(m.intraday_1d.intraday_vwap, 2)
                          : '–'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-200 whitespace-nowrap">
                        {m.atr14 !== null ? `${formatNum(m.atr14, 2)} (${formatNum(m.atr14_pct, 2)}%)` : '–'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-200 whitespace-nowrap">
                        {m.rsi14 !== null ? formatNum(m.rsi14, 1) : '–'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-xs text-slate-300 whitespace-nowrap">
                        {m.pivot_points
                          ? `${formatNum(m.pivot_points.s1, 1)} / ${formatNum(m.pivot_points.pp, 1)} / ${formatNum(m.pivot_points.r1, 1)}`
                          : '–'}
                      </td>
                      <td className="py-2.5 pl-3 text-xs text-slate-300 whitespace-nowrap">
                        {m.trend_regime}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {cryptoDerivatives.length > 0 && (
            <div className="border-t border-slate-800 pt-4">
              <h4 className="text-sm font-semibold text-slate-100">
                Krypto-Derivate &amp; Positionierung (Funding Rate &amp; Open Interest)
              </h4>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-3 text-left font-medium">Asset</th>
                      <th className="py-2 px-3 text-right font-medium">Mark-Preis</th>
                      <th className="py-2 px-3 text-right font-medium">Funding Rate</th>
                      <th className="py-2 px-3 text-right font-medium">Open Interest</th>
                      <th className="py-2 px-3 text-right font-medium">24h Futures-Volumen</th>
                      <th className="py-2 pl-3 text-left font-medium">Quelle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {cryptoDerivatives.map((m) => (
                      <tr key={m.name}>
                        <td className="py-2 pr-3 font-medium text-slate-100">{m.name}</td>
                        <td className="py-2 px-3 text-right font-mono-num text-slate-200">
                          {m.derivatives?.mark_price !== null
                            ? formatNum(m.derivatives?.mark_price, 2)
                            : '–'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num">
                          <span
                            className={
                              (m.derivatives?.funding_rate_pct ?? 0) > 0.02
                                ? 'text-amber-300'
                                : (m.derivatives?.funding_rate_pct ?? 0) < -0.01
                                  ? 'text-emerald-400'
                                  : 'text-slate-200'
                            }
                          >
                            {m.derivatives?.funding_rate_pct !== null
                              ? `${m.derivatives?.funding_rate_pct} %`
                              : '–'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num text-slate-200">
                          {formatCompactUsd(m.derivatives?.open_interest_usd)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num text-slate-300">
                          {formatCompactUsd(m.derivatives?.volume_24h_usd)}
                        </td>
                        <td className="py-2 pl-3 text-slate-400">{m.derivatives?.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-100">
              KI-Marktanalyse, Dip-Tipps, Setups (Einstieg / SL / TP) &amp; Börseneröffnung
            </h3>
            {analysis && (
              <button
                type="button"
                disabled={ttsLoading}
                onClick={async () => {
                  setTtsError(null);
                  setTtsLoading(true);
                  try {
                    const text = [
                      analysis.executive_summary,
                      analysis.market_open_overview,
                      analysis.disclaimer,
                    ]
                      .filter(Boolean)
                      .join(' ');
                    const res = await fetch('/api/tts-speak', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text, voice }),
                    });
                    const payload = await res.json();
                    if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
                    setAudioBase64(payload.audio_base64);
                  } catch (err) {
                    setTtsError(
                      err instanceof Error ? err.message : 'Sprachausgabe fehlgeschlagen.'
                    );
                  } finally {
                    setTtsLoading(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {ttsLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Erzeuge Stimme …
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Zusammenfassung vorlesen ({voice})
                  </>
                )}
              </button>
            )}
          </div>
          {ttsError && (
            <p role="alert" className="text-xs text-rose-400">
              {ttsError}
            </p>
          )}
          {audioUrl && (
            <audio controls autoPlay src={audioUrl} className="w-full max-w-xl h-9" />
          )}
          {!analysis ? (
            <p className="mt-2 text-sm text-slate-400">
              Gemini-Synthese aktuell nicht verfügbar. Prüfe die Hinweise oben oder versuche es erneut.
            </p>
          ) : (
            <div className="mt-2 space-y-3 text-sm text-slate-200 leading-relaxed max-w-5xl">
              <p>{analysis.executive_summary}</p>
              {analysis.market_open_overview && (
                <div className="border-t border-slate-800/80 pt-3">
                  <h4 className="text-xs font-semibold text-blue-300 mb-1">
                    Überblick zur nächsten Börseneröffnung
                  </h4>
                  <p className="text-slate-300">{analysis.market_open_overview}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {analysis && analysis.assets.length > 0 && (
          <div className="divide-y divide-slate-800 border-t border-slate-800">
            {analysis.assets.map((asset) => {
              const regime = asset.market_regime;
              const setup = asset.trade_setup_idea;
              const open = asset.next_day_open_outlook;
              const sizing = computePositionSizing(
                report.account_size,
                report.risk_per_trade_pct,
                setup.entry_price,
                setup.stop_loss_price
              );
              return (
                <div key={asset.name} className="py-6 space-y-5 first:pt-5 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h4 className="text-lg font-semibold text-slate-100">{asset.name}</h4>
                    <span className="text-xs font-medium text-slate-300">
                      Phase: {regime.phase} · Eröffnung: {open.bias} (Konfidenz {open.confidence})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div>
                        <h5 className="text-xs font-semibold text-slate-400 mb-1">
                          Wie bewegt sich der Markt?
                        </h5>
                        <p className="text-sm text-slate-200 leading-relaxed">
                          {regime.movement_explanation}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Momentum: {regime.momentum_assessment}
                        </p>
                      </div>

                      <div>
                        <h5 className="text-xs font-semibold text-slate-400 mb-1.5">
                          Tipps für Dips &amp; Schlüsselbewegungen
                        </h5>
                        {asset.dip_and_movement_tips.length > 0 ? (
                          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-200">
                            {asset.dip_and_movement_tips.map((tip, idx) => (
                              <li key={idx}>{tip}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-slate-400">Keine Dip-Hinweise vorhanden.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-[#0B111E] p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-100">
                          Technisches Setup-Szenario ({setup.direction})
                        </span>
                        <span className="font-mono-num text-xs font-semibold text-blue-300">
                          CRV: {setup.risk_reward_ratio}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-slate-400">Einstiegszone</div>
                          <div className="font-mono-num font-semibold text-slate-100 mt-0.5">
                            {setup.entry_zone}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Stop-Loss</div>
                          <div className="font-mono-num font-semibold text-rose-400 mt-0.5">
                            {setup.stop_loss}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Take-Profit 1</div>
                          <div className="font-mono-num font-semibold text-emerald-400 mt-0.5">
                            {setup.take_profit_1}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Take-Profit 2</div>
                          <div className="font-mono-num font-semibold text-emerald-400 mt-0.5">
                            {setup.take_profit_2}
                          </div>
                        </div>
                      </div>

                      {sizing && (
                        <div className="border-t border-slate-800/80 pt-2 text-xs text-slate-200 font-mono-num">
                          Positionsgröße ({report.risk_per_trade_pct} % = {formatNum(sizing.riskAmount, 0)} max. Risiko):{' '}
                          <strong>{sizing.units} Einheiten</strong> · Positionswert{' '}
                          {formatNum(sizing.positionValue, 0)} · SL-Abstand {sizing.stopDistancePct} %
                        </div>
                      )}

                      <div className="border-t border-slate-800/80 pt-2.5 space-y-1 text-xs text-slate-300">
                        <p>
                          <span className="text-slate-400">Begründung: </span>
                          {setup.rationale}
                        </p>
                        <p>
                          <span className="text-slate-400">Positionsrisiko: </span>
                          {setup.position_risk_note}
                        </p>
                        <p>
                          <span className="text-slate-400">Invalidation: </span>
                          {setup.invalidation_condition}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-[#0B111E] p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h5 className="text-xs font-semibold text-blue-300">
                        Prognose nächste Börseneröffnung · Tendenz: {open.bias} · Konfidenz:{' '}
                        {open.confidence}
                      </h5>
                      <span className="font-mono-num text-[11px] text-slate-400">
                        {open.sources_used_count} Quellen ausgewertet
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {open.expected_open_scenario}
                    </p>
                    {open.news_impact_summary && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        <span className="font-semibold text-slate-200">Nachrichten-Einfluss: </span>
                        {open.news_impact_summary}
                      </p>
                    )}
                    {open.key_levels_to_watch.length > 0 && (
                      <p className="text-xs text-slate-400 font-mono-num">
                        Relevante Marken: {open.key_levels_to_watch.join(' · ')}
                      </p>
                    )}
                    {open.catalysts_and_risks.length > 0 && (
                      <ul className="list-disc pl-5 space-y-0.5 text-xs text-slate-300">
                        {open.catalysts_and_risks.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h5 className="text-xs font-semibold text-slate-400 mb-1.5">
                      Beobachtete Rohdaten
                    </h5>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                      {asset.observed_data.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="text-xs font-semibold text-emerald-400 mb-1.5">
                        Mögliche positive Faktoren
                      </h5>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                        {asset.positive_factors.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h5 className="text-xs font-semibold text-rose-400 mb-1.5">
                        Mögliche negative Faktoren &amp; Risiken
                      </h5>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                        {asset.negative_factors.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {asset.source_urls.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-slate-400 mb-1">
                        Verwendete Quell-URLs
                      </h5>
                      <ul className="space-y-1 text-xs">
                        {asset.source_urls.map((rawUrl, idx) => {
                          const safe = safeHttpUrl(rawUrl);
                          return (
                            <li key={idx}>
                              {safe ? (
                                <a
                                  href={safe}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline break-all"
                                >
                                  {safe}
                                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                </a>
                              ) : (
                                <span className="text-slate-400">{rawUrl}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {analysis && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-800 pt-5">
            <div>
              <h4 className="text-sm font-semibold text-slate-100 mb-2">
                Quellenqualität &amp; Widersprüche
              </h4>
              {analysis.source_quality_and_conflicts.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                  {analysis.source_quality_and_conflicts.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Keine Widersprüche gemeldet.</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-100 mb-2">Datenlücken</h4>
              {analysis.data_gaps.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                  {analysis.data_gaps.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Keine Datenlücken gemeldet.</p>
              )}
            </div>
          </div>
        )}

        {analysis?.disclaimer && (
          <p className="border-t border-slate-800 pt-4 text-xs text-slate-400">
            {analysis.disclaimer}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#111827] p-5">
        <h3 className="text-base font-semibold text-slate-100">
          Aktuelle Markt-Nachrichten (Google News RSS)
        </h3>
        {report.news_results.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Keine RSS-Nachrichten gefunden.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.news_results.map((item, idx) => {
              const safe = safeHttpUrl(item.url);
              return (
                <li
                  key={`${item.url}-${idx}`}
                  className="border-b border-slate-800/70 pb-3 text-sm"
                >
                  <div>
                    {safe ? (
                      <a
                        href={safe}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span className="font-medium text-slate-200">{item.title}</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {item.asset} · {item.publisher} · {item.published_at}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-800 bg-[#111827] p-5">
          <h3 className="text-base font-semibold text-slate-100">Web-Recherche (Google CSE)</h3>
          {report.web_results.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">
              Keine zusätzlichen Google-Web-Ergebnisse vorhanden.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-800/70">
              {report.web_results.map((item, idx) => {
                const safe = safeHttpUrl(item.url);
                return (
                  <li key={`${item.url}-${idx}`} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      {safe ? (
                        <a
                          href={safe}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {item.title || safe}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-200">{item.title}</span>
                      )}
                      <span className="text-xs text-slate-400">· {item.asset}</span>
                    </div>
                    {item.snippet && (
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                        {item.snippet}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-[#111827] p-5">
          <h3 className="text-base font-semibold text-slate-100">
            YouTube-Shorts-Kandidaten (bis 60 Sekunden)
          </h3>
          {report.videos.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">
              Keine YouTube-Shorts gefunden.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-800/70">
              {report.videos.map((video) => {
                const safe = safeHttpUrl(video.url);
                return (
                  <li key={video.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="text-sm">
                      {safe ? (
                        <a
                          href={safe}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {video.title}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-200">{video.title}</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400 font-mono-num">
                      {video.channel} · {video.duration_seconds} s · Aufrufe: {video.views}
                    </div>
                    {video.description && (
                      <p className="mt-1 text-xs text-slate-400 line-clamp-3">
                        {video.description}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
