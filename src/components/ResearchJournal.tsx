import { useState } from 'react';
import { CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import type { JournalEntry, ResearchApiResponse, SetupVerificationResult } from '../types/research';
import { formatNum, formatPct } from '../utils/formatters';

interface ResearchJournalProps {
  entries: JournalEntry[];
  onLoadReport: (report: ResearchApiResponse) => void;
  onUpdateVerifications: (
    entryId: string,
    verifications: SetupVerificationResult[],
    verifiedAt: string
  ) => void;
  onDeleteEntry: (entryId: string) => void;
  onClearAll: () => void;
}

const OUTCOME_STYLE: Record<SetupVerificationResult['outcome'], string> = {
  'TP2 erreicht': 'text-emerald-400 font-semibold',
  'TP1 erreicht': 'text-emerald-400 font-semibold',
  'Im Plus (offen)': 'text-emerald-300',
  'Stop-Loss berührt': 'text-rose-400 font-semibold',
  'Im Minus (offen)': 'text-rose-300',
  'Neutral / Abwarten': 'text-slate-400',
  'Kurs nicht verfügbar': 'text-slate-500',
};

export function ResearchJournal({
  entries,
  onLoadReport,
  onUpdateVerifications,
  onDeleteEntry,
  onClearAll,
}: ResearchJournalProps) {
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleVerify = async (entry: JournalEntry) => {
    const analysis = entry.report.analysis;
    const marketMap = new Map(entry.report.market_data.map((m) => [m.name, m]));

    const items = (analysis?.assets || []).map((asset) => {
      const snap = marketMap.get(asset.name);
      return {
        asset: asset.name,
        direction: asset.trade_setup_idea.direction,
        entry_price: asset.trade_setup_idea.entry_price,
        stop_loss_price: asset.trade_setup_idea.stop_loss_price,
        take_profit_1_price: asset.trade_setup_idea.take_profit_1_price,
        take_profit_2_price: asset.trade_setup_idea.take_profit_2_price,
        open_bias: asset.next_day_open_outlook.bias,
        baseline_close: snap?.latest_close ?? 0,
      };
    });

    if (items.length === 0) return;

    setVerifyError(null);
    setVerifyingId(entry.id);
    try {
      const res = await fetch('/api/verify-setups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onUpdateVerifications(entry.id, data.results || [], data.verified_at);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Prüfung fehlgeschlagen.');
    } finally {
      setVerifyingId(null);
    }
  };

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 bg-[#111827] px-6 py-14 text-center">
        <h2 className="text-lg font-semibold text-slate-100">
          Noch keine gespeicherten Research-Läufe
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
          Jeder abgeschlossene Deep-Research-Lauf wird hier automatisch protokolliert, damit du deine Setups und Eröffnungsprognosen später gegen reale Kurse prüfen kannst.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#111827] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Prognose-Journal &amp; Treffer-Verifikation ({entries.length})
          </h2>
          <p className="text-xs text-slate-400">
            Speichert deine bisherigen Eröffnungsszenarien lokal und gleicht sie bei Klick gegen aktuelle Live-Kurse ab.
          </p>
        </div>

        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0B111E] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 hover:border-rose-500/40 transition-colors cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Journal leeren
        </button>
      </div>

      {verifyError && (
        <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/20 px-4 py-2.5 text-xs text-rose-300">
          {verifyError}
        </div>
      )}

      <div className="space-y-4">
        {entries.map((entry) => {
          const r = entry.report;
          const isVerifying = verifyingId === entry.id;
          const verificationMap = new Map(
            (entry.verifications || []).map((v) => [v.asset, v])
          );

          return (
            <article
              key={entry.id}
              className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    {r.assets.join(', ')}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 font-mono-num">
                    <span>Erstellt: {r.created_at.replace('T', ' ').slice(0, 19)} UTC</span>
                    <span aria-hidden="true">·</span>
                    <span>Stil: {r.trading_style}</span>
                    <span aria-hidden="true">·</span>
                    <span>Risiko: {r.risk_per_trade_pct} %</span>
                    {entry.verified_at && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          Zuletzt geprüft: {entry.verified_at.replace('T', ' ').slice(0, 19)} UTC
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleVerify(entry)}
                    disabled={isVerifying || !r.analysis}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        Prüfe Kurse …
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Gegen aktuelle Kurse prüfen
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onLoadReport(r)}
                    className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Bericht öffnen
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteEntry(entry.id)}
                    aria-label="Eintrag löschen"
                    className="rounded-lg border border-slate-800 bg-[#0B111E] p-1.5 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {r.analysis && r.analysis.assets.length > 0 && (
                <div className="overflow-x-auto border-t border-slate-800/80 pt-3">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 pr-3 text-left font-medium">Markt</th>
                        <th className="py-2 px-3 text-left font-medium">Richtung &amp; Eröffnung</th>
                        <th className="py-2 px-3 text-right font-medium">Einstieg</th>
                        <th className="py-2 px-3 text-right font-medium">Stop-Loss</th>
                        <th className="py-2 px-3 text-right font-medium">TP 1</th>
                        <th className="py-2 px-3 text-right font-medium">Aktueller Kurs</th>
                        <th className="py-2 pl-3 text-right font-medium">Status / Auswertung</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {r.analysis.assets.map((asset) => {
                        const s = asset.trade_setup_idea;
                        const ver = verificationMap.get(asset.name);
                        return (
                          <tr key={asset.name}>
                            <td className="py-2 pr-3 font-medium text-slate-100 whitespace-nowrap">
                              {asset.name}
                            </td>
                            <td className="py-2 px-3 text-slate-300 whitespace-nowrap">
                              {s.direction} · {asset.next_day_open_outlook.bias}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-num text-slate-200">
                              {s.entry_price !== null ? formatNum(s.entry_price, 2) : '–'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-num text-rose-400">
                              {s.stop_loss_price !== null ? formatNum(s.stop_loss_price, 2) : '–'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-num text-emerald-400">
                              {s.take_profit_1_price !== null
                                ? formatNum(s.take_profit_1_price, 2)
                                : '–'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-num text-slate-100">
                              {ver && ver.current_price !== null ? (
                                <span>
                                  {formatNum(ver.current_price, 2)}{' '}
                                  <span
                                    className={
                                      (ver.change_since_report_pct ?? 0) >= 0
                                        ? 'text-emerald-400'
                                        : 'text-rose-400'
                                    }
                                  >
                                    ({formatPct(ver.change_since_report_pct)})
                                  </span>
                                </span>
                              ) : (
                                '–'
                              )}
                            </td>
                            <td
                              className={`py-2 pl-3 text-right whitespace-nowrap ${
                                ver ? OUTCOME_STYLE[ver.outcome] : 'text-slate-500'
                              }`}
                            >
                              {ver ? `${ver.outcome} · ${ver.bias_match}` : 'Noch nicht geprüft'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
