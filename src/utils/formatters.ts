import type { ResearchApiResponse } from '../types/research';

export function safeHttpUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const parsed = new URL(String(raw).trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

export function formatPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)} %`;
}

export function formatNum(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCompactUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} Mrd. $`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} Mio. $`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} Tsd. $`;
  return `${value.toFixed(0)} $`;
}

export function formatUtcDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  return iso.slice(0, 10);
}

export interface PositionSizingResult {
  riskAmount: number;
  stopDistancePct: number;
  units: number;
  positionValue: number;
}

export function computePositionSizing(
  accountSize: number,
  riskPct: number,
  entryPrice: number | null | undefined,
  stopLossPrice: number | null | undefined
): PositionSizingResult | null {
  if (
    !Number.isFinite(accountSize) ||
    accountSize <= 0 ||
    !Number.isFinite(riskPct) ||
    riskPct <= 0 ||
    typeof entryPrice !== 'number' ||
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0 ||
    typeof stopLossPrice !== 'number' ||
    !Number.isFinite(stopLossPrice) ||
    stopLossPrice <= 0
  ) {
    return null;
  }

  const priceDiff = Math.abs(entryPrice - stopLossPrice);
  if (priceDiff <= 0) return null;

  const riskAmount = (accountSize * riskPct) / 100;
  const units = riskAmount / priceDiff;
  const positionValue = units * entryPrice;
  const stopDistancePct = (priceDiff / entryPrice) * 100;

  return {
    riskAmount: Number(riskAmount.toFixed(2)),
    stopDistancePct: Number(stopDistancePct.toFixed(2)),
    units: units >= 10 ? Number(units.toFixed(2)) : Number(units.toFixed(4)),
    positionValue: Number(positionValue.toFixed(2)),
  };
}

export interface SessionStatus {
  label: string;
  stateText: string;
  isOpen: boolean;
}

export function getExchangeSessionStatuses(now: Date = new Date()): SessionStatus[] {
  // Berlin-Ortszeit über Intl.DateTimeFormat präzise berechnen (inkl. Sommer-/Winterzeit)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const minutesOfDay = hour * 60 + minute;
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';

  const formatCountdown = (targetMinutes: number) => {
    const diff = targetMinutes >= minutesOfDay
      ? targetMinutes - minutesOfDay
      : 24 * 60 - minutesOfDay + targetMinutes;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  // Xetra / DAX: Mo–Fr 09:00–17:30 MEZ
  const xetraOpen = !isWeekend && minutesOfDay >= 9 * 60 && minutesOfDay < 17 * 60 + 30;
  const xetraText = xetraOpen
    ? `Geöffnet (Schluss in ${formatCountdown(17 * 60 + 30)})`
    : isWeekend
      ? 'Wochenende (Montag 09:00 MEZ)'
      : `Öffnet in ${formatCountdown(9 * 60)}`;

  // NYSE / Nasdaq: Mo–Fr 15:30–22:00 MEZ
  const usOpen = !isWeekend && minutesOfDay >= 15 * 60 + 30 && minutesOfDay < 22 * 60;
  const usText = usOpen
    ? `Geöffnet (Schluss in ${formatCountdown(22 * 60)})`
    : isWeekend
      ? 'Wochenende (Montag 15:30 MEZ)'
      : `Öffnet in ${formatCountdown(15 * 60 + 30)}`;

  return [
    { label: 'Frankfurt (DAX)', stateText: xetraText, isOpen: xetraOpen },
    { label: 'New York (S&P / Nasdaq)', stateText: usText, isOpen: usOpen },
    { label: 'Krypto (BTC / ETH / SOL)', stateText: '24/7 aktiv', isOpen: true },
  ];
}

export function base64ToBlobUrl(base64: string, mimeType = 'audio/wav'): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function formatMarkdownReport(report: ResearchApiResponse): string {
  const lines: string[] = [
    '# Kronberg Market Desk — Multi-Quellen-Marktanalyse & Eröffnungs-Szenarien',
    '',
    `- **Märkte:** ${report.assets.join(', ')}`,
    `- **Zeitraum:** ${report.period}`,
    `- **Handelsstil:** ${report.trading_style} · **Setup-Fokus:** ${report.setup_focus} · **Konto:** ${report.account_size} · **Risiko/Setup:** ${report.risk_per_trade_pct} %`,
    `- **Zusatzsuche:** ${report.query || '–'}`,
    `- **Erstellt (UTC):** ${report.created_at}`,
    '',
  ];

  if (report.warnings.length > 0) {
    lines.push('## Hinweise & Warnungen', ...report.warnings.map((w) => `- ${w}`), '');
  }

  if (report.macro_sentiment) {
    lines.push(
      '## Makro-Stimmungsindex',
      `- **${report.macro_sentiment.name}:** ${report.macro_sentiment.value}/100 (${report.macro_sentiment.classification}) — Quelle: ${report.macro_sentiment.url}`,
      ''
    );
  }

  if (report.market_data.length > 0) {
    lines.push('## Marktkennzahlen & 1-Tages-Intraday (Yahoo Finance)');
    for (const m of report.market_data) {
      const intraday = m.intraday_1d
        ? `1T-Intraday (${m.intraday_1d.session_date}): Open ${m.intraday_1d.day_open} · Tief ${m.intraday_1d.day_low} · Hoch ${m.intraday_1d.day_high} · VWAP ${m.intraday_1d.intraday_vwap ?? '–'} · ${formatPct(m.intraday_1d.intraday_change_pct)}`
        : '1T-Intraday: –';
      const deriv = m.derivatives
        ? ` · Funding ${m.derivatives.funding_rate_pct ?? '–'} % · OI ${formatCompactUsd(m.derivatives.open_interest_usd)}`
        : '';
      lines.push(
        `- **${m.name} (${m.ticker})** — Scanner ${m.scanner_score.total}/100 · Schlusskurs ${m.latest_close} ${m.currency} · Tag ${formatPct(m.daily_change_pct)} · ATR(14) ${m.atr14 ?? '–'} (${m.atr14_pct ?? '–'} %) · RSI(14) ${m.rsi14 ?? '–'} · Regime: ${m.trend_regime} · ${intraday}${deriv}`
      );
    }
    lines.push('');
  }

  const analysis = report.analysis;
  if (analysis) {
    lines.push('## Gemini-Synthese', '', analysis.executive_summary, '');
    if (analysis.market_open_overview) {
      lines.push('### Überblick zur nächsten Börseneröffnung', '', analysis.market_open_overview, '');
    }

    for (const asset of analysis.assets) {
      lines.push(`### ${asset.name}`);
      lines.push(
        `**Marktbewegung (${asset.market_regime.phase}):** ${asset.market_regime.movement_explanation} (Momentum: ${asset.market_regime.momentum_assessment})`
      );
      if (asset.dip_and_movement_tips.length > 0) {
        lines.push('**Dip- & Bewegungstipps:**', ...asset.dip_and_movement_tips.map((x) => `- ${x}`));
      }
      const s = asset.trade_setup_idea;
      const sizing = computePositionSizing(
        report.account_size,
        report.risk_per_trade_pct,
        s.entry_price,
        s.stop_loss_price
      );
      lines.push(
        '**Technisches Setup-Szenario (Research):**',
        `- Richtung: ${s.direction}`,
        `- Einstiegszone: ${s.entry_zone}`,
        `- Stop-Loss: ${s.stop_loss}`,
        `- Take-Profit 1: ${s.take_profit_1}`,
        `- Take-Profit 2: ${s.take_profit_2}`,
        `- CRV: ${s.risk_reward_ratio}`,
        ...(sizing
          ? [
              `- Positionsgröße (${report.risk_per_trade_pct}% = ${sizing.riskAmount}): ${sizing.units} Einheiten (Positionswert ${sizing.positionValue}, Stop-Abstand ${sizing.stopDistancePct}%)`,
            ]
          : []),
        `- Positionsrisiko: ${s.position_risk_note}`,
        `- Invalidation: ${s.invalidation_condition}`,
        `- Begründung: ${s.rationale}`
      );
      const open = asset.next_day_open_outlook;
      lines.push(
        `**Eröffnungsprognose (${open.bias}, Konfidenz: ${open.confidence}, Quellen: ${open.sources_used_count}):** ${open.expected_open_scenario}`
      );
      if (open.news_impact_summary) {
        lines.push(`- Nachrichten-Einfluss: ${open.news_impact_summary}`);
      }
      if (open.key_levels_to_watch.length > 0) {
        lines.push(`- Wichtige Marken: ${open.key_levels_to_watch.join(' · ')}`);
      }
      if (asset.source_urls.length > 0) {
        lines.push('**Quellen:**', ...asset.source_urls.map((u) => `- ${u}`));
      }
      lines.push('');
    }
  }

  if (report.news_results.length > 0) {
    lines.push('## Aktuelle Nachrichten (Google News RSS)');
    for (const n of report.news_results) {
      lines.push(`- [${n.title}](${n.url}) (${n.asset} · ${n.publisher} · ${n.published_at})`);
    }
    lines.push('');
  }

  lines.push('---', `*${report.disclaimer}*`);
  return lines.join('\n');
}
