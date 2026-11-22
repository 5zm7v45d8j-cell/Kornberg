export type PeriodKey = '3mo' | '6mo' | '1y' | '2y';

export type ChartTimeframeKey = '1D' | '5D' | '1M' | '6M';

export type TradingStyleKey = 'intraday' | 'swing' | 'position';

export type SetupFocusKey = 'both' | 'long_only' | 'short_only';

export type AssetCategoryKey = 'krypto' | 'indizes_fx' | 'rohstoffe';

export interface AssetConfig {
  ticker: string;
  tradingview: string;
  search: string;
  tradingDays: number;
  category: AssetCategoryKey;
  defaultSelected?: boolean;
  krakenFuturesSymbol?: string;
}

export interface AppConfigResponse {
  assets: Record<string, AssetConfig>;
  periods: Record<PeriodKey, string>;
}

export interface OhlcCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface DerivativesSnapshot {
  funding_rate_pct: number | null;
  open_interest_usd: number | null;
  mark_price: number | null;
  volume_24h_usd: number | null;
  source: string;
}

export interface ScannerScore {
  total: number;
  breakdown: string[];
}

export interface MarketSnapshot {
  name: string;
  ticker: string;
  category: AssetCategoryKey;
  as_of: string;
  latest_close: number;
  daily_change_pct: number;
  period_return_pct: number;
  annualized_volatility_pct: number;
  expected_daily_move_pct: number;
  atr14: number | null;
  atr14_pct: number | null;
  ema9: number | null;
  ema21: number | null;
  sma20: number | null;
  sma50: number | null;
  rsi14: number | null;
  bollinger_upper: number | null;
  bollinger_lower: number | null;
  pivot_points: {
    pp: number;
    r1: number;
    r2: number;
    s1: number;
    s2: number;
  } | null;
  volume_ratio: number | null;
  trend_regime: string;
  max_drawdown_pct: number;
  currency: string;
  intraday_1d: {
    session_date: string;
    day_open: number | null;
    day_high: number | null;
    day_low: number | null;
    day_close: number | null;
    intraday_vwap: number | null;
    intraday_change_pct: number | null;
    range_position_pct: number | null;
    bars_count: number;
  } | null;
  intraday_candles: OhlcCandle[];
  derivatives: DerivativesSnapshot | null;
  scanner_score: ScannerScore;
  source: string;
}

export interface NewsItem {
  asset: string;
  title: string;
  url: string;
  published_at: string;
  publisher: string;
  source_type: 'google_news_rss';
}

export interface MacroSentiment {
  name: string;
  value: number;
  classification: string;
  updated_at: string;
  source: string;
  url: string;
}

export interface WebResult {
  asset: string;
  title: string;
  url: string;
  snippet: string;
}

export interface VideoCandidate {
  id: string;
  asset: string;
  title: string;
  channel: string;
  published_at: string;
  description: string;
  duration_seconds: number;
  views: string;
  url: string;
  suggested_preview_seconds: number;
}

export interface NextDayOpenOutlook {
  bias: 'bullish' | 'neutral' | 'bearish' | 'gemischt';
  confidence: 'niedrig' | 'mittel' | 'hoch';
  expected_open_scenario: string;
  news_impact_summary?: string;
  key_levels_to_watch: string[];
  catalysts_and_risks: string[];
  sources_used_count: number;
}

export interface AssetNextDayMarketOutlook {
  asset: string;
  bias: 'bullish' | 'neutral' | 'bearish' | 'gemischt';
  confidence: 'niedrig' | 'mittel' | 'hoch';
  opening_forecast: string;
  news_impact_summary: string;
  key_levels: string[];
  risk_factors: string[];
  sources_used_count: number;
}

export interface NextDayMarketOutlookSummary {
  overview: string;
  by_asset: AssetNextDayMarketOutlook[];
}

export interface MarketRegimeAnalysis {
  phase: string;
  momentum_assessment: string;
  movement_explanation: string;
}

export interface TradeSetupIdea {
  direction: 'Long (Dip-Szenario)' | 'Short (Rücksetzer-Szenario)' | 'Abwarten (Kein klares Setup)';
  entry_zone: string;
  entry_price: number | null;
  stop_loss: string;
  stop_loss_price: number | null;
  take_profit_1: string;
  take_profit_1_price: number | null;
  take_profit_2: string;
  take_profit_2_price: number | null;
  risk_reward_ratio: string;
  position_risk_note: string;
  invalidation_condition: string;
  rationale: string;
}

export interface MarketResearchAssetAnalysis {
  name: string;
  observed_data: string[];
  market_regime: MarketRegimeAnalysis;
  dip_and_movement_tips: string[];
  trade_setup_idea: TradeSetupIdea;
  positive_factors: string[];
  negative_factors: string[];
  interpretation: string;
  next_day_open_outlook: NextDayOpenOutlook;
  source_urls: string[];
}

export interface MarketResearchYoutubeObservation {
  title: string;
  channel: string;
  published_at: string;
  url: string;
  metadata_only_caveat: string;
}

export interface MarketResearchResponse {
  query: string;
  created_at_utc: string;
  executive_summary: string;
  market_open_overview: string;
  assets: MarketResearchAssetAnalysis[];
  youtube_observations: MarketResearchYoutubeObservation[];
  source_quality_and_conflicts: string[];
  data_gaps: string[];
  disclaimer: string;
}

export interface ResearchApiResponse {
  query: string;
  assets: string[];
  period: PeriodKey;
  trading_style: TradingStyleKey;
  setup_focus: SetupFocusKey;
  risk_per_trade_pct: number;
  account_size: number;
  created_at: string;
  market_data: MarketSnapshot[];
  news_results: NewsItem[];
  macro_sentiment: MacroSentiment | null;
  web_results: WebResult[];
  videos: VideoCandidate[];
  analysis: MarketResearchResponse | null;
  next_day_market_outlook: NextDayMarketOutlookSummary | null;
  warnings: string[];
  disclaimer: string;
}

export interface SetupVerificationResult {
  asset: string;
  current_price: number | null;
  baseline_close: number;
  change_since_report_pct: number | null;
  outcome:
    | 'TP2 erreicht'
    | 'TP1 erreicht'
    | 'Stop-Loss berührt'
    | 'Im Plus (offen)'
    | 'Im Minus (offen)'
    | 'Neutral / Abwarten'
    | 'Kurs nicht verfügbar';
  bias_match: 'Bestätigt' | 'Gegenläufig' | 'Offen / Neutral';
}

export interface JournalEntry {
  id: string;
  report: ResearchApiResponse;
  verifications?: SetupVerificationResult[];
  verified_at?: string;
}

export type VoiceNameKey = 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface NewsClusterAnalysis {
  topic: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'gemischt';
  impact_level: 'hoch' | 'mittel' | 'niedrig';
  affected_assets: string[];
  analytical_takeaway: string;
  source_url: string;
}

export interface UsOpenTipItem {
  asset: string;
  phase: string;
  tip: string;
  key_level: string;
}

export interface UsOpenBriefingContent {
  headline: string;
  us_open_context: string;
  market_mood_summary: string;
  news_analysis: NewsClusterAnalysis[];
  us_open_tips: UsOpenTipItem[];
  spoken_script: string;
  disclaimer: string;
}

export interface UsOpenBriefingResponse {
  created_at: string;
  voice: VoiceNameKey;
  assets: string[];
  briefing: UsOpenBriefingContent;
  audio_base64: string | null;
  audio_mime_type: string;
  audio_error?: string | null;
  news_count: number;
}

