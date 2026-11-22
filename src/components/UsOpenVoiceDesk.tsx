import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Headphones,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Volume2,
} from 'lucide-react';
import type { UsOpenBriefingResponse, VoiceNameKey } from '../types/research';
import {
  base64ToBlobUrl,
  getExchangeSessionStatuses,
  safeHttpUrl,
} from '../utils/formatters';

interface UsOpenVoiceDeskProps {
  selectedAssets: string[];
  query: string;
  voice: VoiceNameKey;
  onVoiceChange: (voice: VoiceNameKey) => void;
}

export const VOICE_OPTIONS: Array<{ key: VoiceNameKey; label: string }> = [
  { key: 'Charon', label: 'Charon — Chefstratege (ruhig, tief)' },
  { key: 'Kore', label: 'Kore — Marktanalystin (klar, präzise)' },
  { key: 'Fenrir', label: 'Fenrir — Desk-Ökonom (fokussiert)' },
  { key: 'Zephyr', label: 'Zephyr — Senior Advisor (warm, nahbar)' },
];

const SENTIMENT_STYLES: Record<string, string> = {
  bullish: 'text-emerald-400',
  bearish: 'text-rose-400',
  neutral: 'text-slate-300',
  gemischt: 'text-amber-300',
};

function formatAudioSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function UsOpenVoiceDesk({
  selectedAssets,
  query,
  voice,
  onVoiceChange,
}: UsOpenVoiceDeskProps) {
  const [data, setData] = useState<UsOpenBriefingResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRespeaking, setIsRespeaking] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState<boolean>(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [sessions, setSessions] = useState(() => getExchangeSessionStatuses());

  useEffect(() => {
    const timer = setInterval(() => {
      setSessions(getExchangeSessionStatuses());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!data?.audio_base64) {
      setAudioUrl(null);
      return;
    }
    const url = base64ToBlobUrl(data.audio_base64, data.audio_mime_type || 'audio/wav');
    setAudioUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [data?.audio_base64, data?.audio_mime_type]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, audioUrl]);

  const nySession = sessions.find((s) => s.label.startsWith('New York'));

  const handleGenerateBriefing = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const response = await fetch('/api/us-open-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets: selectedAssets,
          voice,
          query,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      setData(payload as UsOpenBriefingResponse);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'US-Open-Briefing fehlgeschlagen.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRespeakWithVoice = async () => {
    if (!data?.briefing?.spoken_script) return;
    setErrorMsg(null);
    setIsRespeaking(true);
    try {
      const response = await fetch('/api/tts-speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: data.briefing.spoken_script,
          voice,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              voice,
              audio_base64: payload.audio_base64,
              audio_mime_type: payload.audio_mime_type || 'audio/wav',
              audio_error: null,
            }
          : prev
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Stimmenwechsel fehlgeschlagen.');
    } finally {
      setIsRespeaking(false);
    }
  };

  const togglePlayPause = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (nextTime: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-blue-400">
              <Headphones className="h-4 w-4" aria-hidden="true" />
              <span>Kronberg Market Desk · Audio-Strategie &amp; News-Einordnung</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-100">
              US-Markteröffnungs-Briefing &amp; Nachrichten-Analyse
            </h2>
            <p className="text-xs text-slate-400">
              Analysiert aktuelle Nachrichten aus Multi-Quellen-Feeds und spricht praxisnahe Orientierungstipps ab US-Börseneröffnung (15:30 Uhr MEZ / 09:30 Uhr ET) in natürlicher Stimme.
            </p>
          </div>

          {nySession && (
            <div className="rounded-lg border border-slate-800 bg-[#0B111E] px-3.5 py-2 text-xs">
              <div className="text-slate-400">New York (NYSE / Nasdaq · 15:30 MEZ)</div>
              <div
                className={`mt-0.5 font-mono-num font-semibold ${
                  nySession.isOpen ? 'text-emerald-400' : 'text-slate-200'
                }`}
              >
                {nySession.stateText}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-slate-800/80 pt-4">
          <label className="min-w-[260px] flex-1 max-w-sm space-y-1">
            <span className="block text-xs font-medium text-slate-300">
              Sprecher-Stimme (natürliches Deutsch)
            </span>
            <select
              value={voice}
              onChange={(e) => onVoiceChange(e.target.value as VoiceNameKey)}
              className="w-full rounded-lg border border-slate-800 bg-[#0B111E] px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
            >
              {VOICE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleGenerateBriefing}
            disabled={isLoading || isRespeaking}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Analysiere News &amp; spreche Briefing …
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                US-Open Audio-Briefing starten
              </>
            )}
          </button>

          {data && data.voice !== voice && (
            <button
              type="button"
              onClick={handleRespeakWithVoice}
              disabled={isRespeaking || isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isRespeaking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Spreche neu …
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Mit gewählter Stimme neu sprechen
                </>
              )}
            </button>
          )}
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/35 bg-rose-950/25 px-4 py-2.5 text-xs text-rose-300"
          >
            {errorMsg}
          </div>
        )}
      </section>

      {!data && !isLoading && (
        <section className="rounded-xl border border-dashed border-slate-800 bg-[#111827] px-6 py-12 text-center space-y-3">
          <h3 className="text-base font-semibold text-slate-100">
            Bereit für dein US-Markteröffnungs-Briefing
          </h3>
          <p className="mx-auto max-w-xl text-xs text-slate-400 leading-relaxed">
            Klicke auf „US-Open Audio-Briefing starten“, um aktuelle Kurse, Intraday-VWAPs, Krypto-Derivate und Google-News-Schlagzeilen auswerten zu lassen und als ruhiges, menschlich klingendes Strategie-Briefing anzuhören.
          </p>
        </section>
      )}

      {data && (
        <>
          {/* Audio-Player & Kernaussage */}
          <section className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  {data.briefing.headline}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 font-mono-num">
                  <span>{data.briefing.us_open_context}</span>
                  <span aria-hidden="true">·</span>
                  <span>Stimme: {data.voice}</span>
                  <span aria-hidden="true">·</span>
                  <span>{data.news_count} Schlagzeilen geprüft</span>
                </div>
              </div>
            </div>

            {audioUrl ? (
              <div className="rounded-lg border border-slate-800 bg-[#0B111E] p-4 space-y-3">
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                  onEnded={() => setIsPlaying(false)}
                />

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlayPause}
                    aria-label={isPlaying ? 'Pause' : 'Abspielen'}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors shrink-0 cursor-pointer"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4 ml-0.5" aria-hidden="true" />
                    )}
                  </button>

                  <div className="min-w-[180px] flex-1 space-y-1">
                    <input
                      type="range"
                      min={0}
                      max={duration || 1}
                      step={0.1}
                      value={currentTime}
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      aria-label="Audio-Fortschritt"
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] font-mono-num text-slate-400">
                      <span>{formatAudioSeconds(currentTime)}</span>
                      <span>{formatAudioSeconds(duration)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {([0.9, 1.0, 1.1] as const).map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setPlaybackRate(rate)}
                        className={`rounded-md border px-2 py-1 text-[11px] font-mono-num transition-colors cursor-pointer ${
                          playbackRate === rate
                            ? 'border-blue-500/60 bg-blue-600/20 text-blue-200'
                            : 'border-slate-800 bg-[#111827] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {rate.toFixed(1)}x
                      </button>
                    ))}
                  </div>

                  <a
                    href={audioUrl}
                    download={`kronberg-us-open-briefing-${data.voice.toLowerCase()}.wav`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    WAV
                  </a>
                </div>
              </div>
            ) : data.audio_error ? (
              <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                {data.audio_error}
              </div>
            ) : null}

            <p className="text-sm text-slate-200 leading-relaxed">
              {data.briefing.market_mood_summary}
            </p>
          </section>

          {/* Nachrichten-Analyse & US-Open-Tipps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-100">
                Analysierte Nachrichtenlage ({data.briefing.news_analysis.length} Themen)
              </h3>
              {data.briefing.news_analysis.length === 0 ? (
                <p className="text-xs text-slate-400">Keine Nachrichten-Cluster vorhanden.</p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {data.briefing.news_analysis.map((item, idx) => {
                    const safeUrl = safeHttpUrl(item.source_url);
                    return (
                      <div key={idx} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className="text-sm font-medium text-slate-100">{item.topic}</h4>
                          <span className="text-[11px] font-mono-num text-slate-400">
                            <span
                              className={`font-semibold capitalize ${
                                SENTIMENT_STYLES[item.sentiment] || 'text-slate-300'
                              }`}
                            >
                              {item.sentiment}
                            </span>{' '}
                            · Einfluss {item.impact_level}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {item.analytical_takeaway}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                          <span>Märkte: {item.affected_assets.join(', ')}</span>
                          {safeUrl && (
                            <a
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline"
                            >
                              Quelle
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-100">
                Orientierungs-Tipps ab US-Markteröffnung
              </h3>
              {data.briefing.us_open_tips.length === 0 ? (
                <p className="text-xs text-slate-400">Keine US-Open-Hinweise erstellt.</p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {data.briefing.us_open_tips.map((item, idx) => (
                    <div key={idx} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-100">
                          {item.asset}
                        </span>
                        <span className="text-[11px] text-blue-300 font-medium">
                          {item.phase}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.tip}</p>
                      <div className="font-mono-num text-[11px] text-slate-400">
                        Schlüsselmarke: <span className="text-slate-200">{item.key_level}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Sprech-Transkript */}
          <section className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-3">
            <button
              type="button"
              onClick={() => setScriptOpen((prev) => !prev)}
              aria-expanded={scriptOpen}
              className="flex w-full items-center justify-between gap-4 text-left text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <span>Gesprochenes Briefing-Manuskript</span>
              {scriptOpen ? (
                <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
              )}
            </button>
            {scriptOpen && (
              <div className="space-y-3 border-t border-slate-800/80 pt-3">
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {data.briefing.spoken_script}
                </p>
                <p className="text-[11px] text-slate-400">{data.briefing.disclaimer}</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
