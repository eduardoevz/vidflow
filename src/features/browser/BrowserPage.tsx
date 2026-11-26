import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, RotateCw, ExternalLink, Film, Download, Trash2, Globe } from 'lucide-react';
import { Button } from '../../components/Button';
import { formatBytes } from '../../utils/format';
import type { BrowserNavigationState, DetectedBrowserMedia } from '../../../shared/ipc-contract';

const URL_PATTERN = /^https?:\/\/\S+$/i;

export function BrowserPage(): JSX.Element {
  const routerNavigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [addressBar, setAddressBar] = useState('https://');
  const [detectedMedia, setDetectedMedia] = useState<DetectedBrowserMedia[]>([]);
  const [showDetected, setShowDetected] = useState(false);
  const [state, setState] = useState<BrowserNavigationState>({
    url: '',
    canGoBack: false,
    canGoForward: false,
    isLoading: false,
  });

  useEffect(() => {
    const unsubscribeNav = window.vidflow.onBrowserNavigationState((s) => {
      setState(s);
      setAddressBar(s.url || 'https://');
    });
    const unsubscribeMedia = window.vidflow.onBrowserMediaDetected((items) => {
      setDetectedMedia(items);
      if (items.length === 0) setShowDetected(false);
    });
    void window.vidflow.browserGetDetectedMedia().then(setDetectedMedia);
    void window.vidflow.browserSetVisible(true);
    return () => {
      unsubscribeNav();
      unsubscribeMedia();
      void window.vidflow.browserSetVisible(false);
    };
  }, []);

  const updateBounds = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    void window.vidflow.browserSetBounds({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  }, []);

  useEffect(() => {
    updateBounds();
    window.addEventListener('resize', updateBounds);
    const interval = setInterval(updateBounds, 400);
    return () => {
      window.removeEventListener('resize', updateBounds);
      clearInterval(interval);
    };
  }, [updateBounds, showDetected, detectedMedia.length]);

  function navigate(): void {
    const target = URL_PATTERN.test(addressBar) ? addressBar : `https://${addressBar}`;
    void window.vidflow.browserNavigate(target);
  }

  function handleAnalyzeDetected(item: DetectedBrowserMedia): void {
    void routerNavigate('/', {
      state: {
        analyzeUrl: item.url,
        referer: item.referer ?? (state.url || undefined),
      },
    });
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3">
      <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised p-1.5 shadow-sm">
        <Button
          variant="ghost"
          disabled={!state.canGoBack}
          onClick={() => void window.vidflow.browserBack()}
          title="Atrás"
          className="px-2.5"
        >
          <ArrowLeft size={16} />
        </Button>
        <Button
          variant="ghost"
          disabled={!state.canGoForward}
          onClick={() => void window.vidflow.browserForward()}
          title="Adelante"
          className="px-2.5"
        >
          <ArrowRight size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => void window.vidflow.browserReload()}
          title="Recargar"
          className="px-2.5"
        >
          <RotateCw size={16} className={state.isLoading ? 'animate-spin' : ''} />
        </Button>

        <div className="flex flex-1 items-center gap-2 rounded-card border border-border/70 bg-surface px-3 py-1.5 focus-within:border-accent/60">
          <Globe size={14} className="shrink-0 text-content-muted" />
          <input
            value={addressBar}
            onChange={(e) => setAddressBar(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate()}
            className="w-full bg-transparent text-sm text-content focus:outline-none"
          />
        </div>

        {detectedMedia.length > 0 && (
          <Button
            variant={showDetected ? 'primary' : 'secondary'}
            onClick={() => setShowDetected((prev) => !prev)}
            title="Videos detectados en esta página"
            className={!showDetected ? 'border-accent/40 text-accent' : ''}
          >
            <Film size={15} />
            Videos ({detectedMedia.length})
          </Button>
        )}

        <Button
          variant="ghost"
          title="Abrir en navegador externo"
          onClick={() => void window.vidflow.openExternal(state.url)}
          className="px-2.5"
        >
          <ExternalLink size={16} />
        </Button>
      </div>

      {showDetected && detectedMedia.length > 0 && (
        <div className="flex max-h-52 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-surface-raised p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-content-muted">
              Streams de video detectados ({detectedMedia.length})
            </span>
            <Button
              variant="ghost"
              onClick={() => void window.vidflow.browserClearDetectedMedia()}
              title="Limpiar lista"
              className="px-2 py-1 text-xs"
            >
              <Trash2 size={13} />
              Limpiar
            </Button>
          </div>
          {detectedMedia.map((item) => (
            <div
              key={item.url}
              className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-3 py-2 transition-colors hover:border-accent/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-accent">
                    {item.type}
                  </span>
                  {item.sizeBytes && (
                    <span className="text-xs font-medium text-content-muted">{formatBytes(item.sizeBytes)}</span>
                  )}
                  {item.pageTitle && (
                    <span className="truncate text-xs font-medium text-content">{item.pageTitle}</span>
                  )}
                </div>
                <p className="truncate text-xs text-content-muted">{item.url}</p>
              </div>
              <Button onClick={() => handleAnalyzeDetected(item)}>
                <Download size={14} />
                Analizar
              </Button>
            </div>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        className="min-h-[300px] flex-1 overflow-hidden rounded-xl border border-border bg-surface-sunken shadow-inner"
      />
    </div>
  );
}
