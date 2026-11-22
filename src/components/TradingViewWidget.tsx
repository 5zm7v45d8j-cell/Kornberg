import { memo, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, RotateCcw } from 'lucide-react';
import type { ChartTimeframeKey } from '../types/research';

interface TradingViewWidgetProps {
  symbol: string;
  height: number;
  timeframe?: ChartTimeframeKey;
}

type WidgetStatus = 'loading' | 'ready' | 'error';

const WIDGET_INIT_TIMEOUT_MS = 12000;
const POST_LOAD_GRACE_MS = 4000;

const TIMEFRAME_TO_TV: Record<ChartTimeframeKey, { interval: string; range: string }> = {
  '1D': { interval: '15', range: '1D' },
  '5D': { interval: '60', range: '5D' },
  '1M': { interval: '240', range: '1M' },
  '6M': { interval: 'D', range: '6M' },
};

export const TradingViewWidget = memo(function TradingViewWidget({
  symbol,
  height,
  timeframe = '1D',
}: TradingViewWidgetProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<WidgetStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);

  const tvTimeframe = TIMEFRAME_TO_TV[timeframe] || TIMEFRAME_TO_TV['1D'];

  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;

    const cleanSymbol = symbol.trim();
    if (!cleanSymbol) {
      container.replaceChildren();
      setStatus('error');
      setErrorMessage('Kein gültiges TradingView-Symbol angegeben.');
      return;
    }

    let disposed = false;
    let initTimer: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;

    const cleanupObservers = () => {
      if (initTimer !== undefined) {
        clearTimeout(initTimer);
        initTimer = undefined;
      }
      if (observer) {
        observer.disconnect();
        observer = undefined;
      }
    };

    const handleFailure = (message: string) => {
      if (disposed) return;
      cleanupObservers();
      container.replaceChildren();
      setStatus('error');
      setErrorMessage(message);
    };

    const handleSuccess = () => {
      if (disposed) return;
      cleanupObservers();
      setStatus('ready');
      setErrorMessage(null);
    };

    setStatus('loading');
    setErrorMessage(null);
    container.replaceChildren();

    try {
      const wrapper = document.createElement('div');
      wrapper.className = 'tradingview-widget-container';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';

      const widgetNode = document.createElement('div');
      widgetNode.className = 'tradingview-widget-container__widget';
      widgetNode.style.width = '100%';
      widgetNode.style.height = '100%';

      const configPayload = JSON.stringify({
        autosize: true,
        symbol: cleanSymbol,
        interval: tvTimeframe.interval,
        range: tvTimeframe.range,
        timezone: 'Europe/Berlin',
        theme: 'dark',
        style: '1',
        locale: 'de_DE',
        allow_symbol_change: false,
        save_image: false,
        calendar: false,
        hide_volume: false,
        support_host: 'https://www.tradingview.com',
      });

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src =
        'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.async = true;
      script.textContent = configPayload;

      observer = new MutationObserver(() => {
        const iframe = wrapper.querySelector('iframe');
        if (iframe) {
          iframe.addEventListener(
            'error',
            () => {
              handleFailure('Der TradingView-Chart-Frame konnte nicht geladen werden.');
            },
            { once: true }
          );
          handleSuccess();
        }
      });
      observer.observe(wrapper, { childList: true, subtree: true });

      initTimer = setTimeout(() => {
        if (!wrapper.querySelector('iframe')) {
          handleFailure(
            'Das TradingView-Widget konnte nicht rechtzeitig initialisiert werden (Zeitüberschreitung oder blockierte Verbindung).'
          );
        }
      }, WIDGET_INIT_TIMEOUT_MS);

      script.addEventListener('error', () => {
        handleFailure(
          'Das TradingView-Skript konnte nicht geladen werden (Netzwerkfehler oder Blockierung durch Browser-Erweiterung).'
        );
      });

      script.addEventListener('load', () => {
        if (disposed) return;
        if (wrapper.querySelector('iframe')) {
          handleSuccess();
          return;
        }
        if (initTimer !== undefined) {
          clearTimeout(initTimer);
        }
        initTimer = setTimeout(() => {
          if (!wrapper.querySelector('iframe')) {
            handleFailure(
              'Das TradingView-Skript wurde geladen, das Chart-Widget konnte jedoch nicht initialisiert werden.'
            );
          }
        }, POST_LOAD_GRACE_MS);
      });

      wrapper.appendChild(widgetNode);
      wrapper.appendChild(script);
      container.appendChild(wrapper);
    } catch (err) {
      const detail =
        err instanceof Error && err.message
          ? err.message
          : 'Unbekannter Initialisierungsfehler.';
      handleFailure(`Widget-Initialisierung fehlgeschlagen: ${detail}`);
    }

    return () => {
      disposed = true;
      cleanupObservers();
      container.replaceChildren();
    };
  }, [symbol, tvTimeframe.interval, tvTimeframe.range, retryKey]);

  const externalChartUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;

  return (
    <div
      style={{ height: `${height}px` }}
      className="relative w-full overflow-hidden rounded-lg bg-[#0E1525]"
    >
      <div
        ref={hostRef}
        className={`h-full w-full ${status === 'error' ? 'hidden' : 'block'}`}
      />

      {status === 'loading' && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0E1525]/80 px-4 text-center"
        >
          <span className="text-xs text-slate-400">
            TradingView 1T-Chart ({symbol}) wird geladen …
          </span>
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 border border-rose-500/30 bg-rose-950/20 px-6 text-center rounded-lg"
        >
          <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0" aria-hidden="true" />
          <div className="space-y-1 max-w-md">
            <p className="text-sm font-semibold text-slate-100">
              TradingView-Widget nicht verfügbar ({symbol})
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {errorMessage || 'Das Chart-Widget konnte nicht initialisiert werden.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setRetryKey((count) => count + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Erneut versuchen
            </button>
            <a
              href={externalChartUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              Auf TradingView öffnen
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
});
