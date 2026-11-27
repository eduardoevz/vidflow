import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  Film,
  Globe,
  ListVideo,
  PanelRightClose,
  Plus,
  RotateCw,
  Shield,
  ShieldOff,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '../../components/Button';
import { formatBytes, formatDuration } from '../../utils/format';
import { buildDownloadRequest } from '../../../shared/downloadRequestBuilder';
import { bestAudio } from '../../../shared/qualitySelection';
import type { MediaFormat, MediaInfo } from '../../../shared/media-types';
import type { BrowserNavigationState, DetectedBrowserMedia } from '../../../shared/ipc-contract';
import { useSettingsStore } from '../../stores/settingsStore';

const URL_PATTERN = /^https?:\/\/\S+$/i;

function formatOptionLabel(format: MediaFormat): string {
  if (format.kind === 'video') {
    return [
      format.resolutionLabel ?? (format.bitrateKbps ? `${Math.round(format.bitrateKbps)} kbps` : 'Video'),
      format.fps ? `${format.fps} FPS` : undefined,
      format.extension.toUpperCase(),
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return [
    format.audioCodec?.toUpperCase() ?? format.extension.toUpperCase(),
    format.bitrateKbps ? `${Math.round(format.bitrateKbps)} kbps` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}

function hostnameOf(rawUrl: string): string | undefined {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function BrowserPage(): JSX.Element {
  const routerNavigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const { settings, update: updateSettings } = useSettingsStore();
  const filenameTemplate = settings.filenameTemplate;

  const [addressBar, setAddressBar] = useState('https://');
  const [detectedMedia, setDetectedMedia] = useState<DetectedBrowserMedia[]>([]);
  const [showDetected, setShowDetected] = useState(false);
  const [state, setState] = useState<BrowserNavigationState>({
    url: '',
    canGoBack: false,
    canGoForward: false,
    isLoading: false,
  });

  // Lateral quality-picker panel state
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [analyzingPage, setAnalyzingPage] = useState(false);
  const [pageMedia, setPageMedia] = useState<MediaInfo | undefined>(undefined);
  const [panelError, setPanelError] = useState<string | undefined>(undefined);
  const [downloadingFormatId, setDownloadingFormatId] = useState<string | undefined>(undefined);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

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
    const el = containerRef.current;
    const observer = el ? new ResizeObserver(() => updateBounds()) : undefined;
    if (el && observer) observer.observe(el);
    const interval = setInterval(updateBounds, 400);
    return () => {
      window.removeEventListener('resize', updateBounds);
      observer?.disconnect();
      clearInterval(interval);
    };
  }, [updateBounds, showDetected, showSidePanel, detectedMedia.length, state.tabs?.length, settings.browserBookmarks.length]);

  function navigate(targetOverride?: string): void {
    const raw = targetOverride ?? addressBar;
    const target = URL_PATTERN.test(raw) ? raw : `https://${raw}`;
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

  async function openQuickDownload(targetUrl?: string, referer?: string): Promise<void> {
    const urlToAnalyze = targetUrl ?? state.url;
    if (!URL_PATTERN.test(urlToAnalyze)) return;

    setShowSidePanel(true);
    setAnalyzingPage(true);
    setPageMedia(undefined);
    setPanelError(undefined);
    setDownloadSuccess(false);

    try {
      const res = await window.vidflow.analyzeUrl(urlToAnalyze, referer ? { referer } : undefined);
      if (res.ok) {
        setPageMedia(res.data);
      } else if (!targetUrl && detectedMedia[0]) {
        const fallback = await window.vidflow.analyzeUrl(detectedMedia[0].url, {
          referer: detectedMedia[0].referer ?? urlToAnalyze,
        });
        if (fallback.ok) {
          setPageMedia(fallback.data);
        } else {
          setPanelError(res.error.suggestion ?? res.error.message);
        }
      } else {
        setPanelError(res.error.suggestion ?? res.error.message);
      }
    } catch (err) {
      setPanelError((err as Error).message);
    } finally {
      setAnalyzingPage(false);
    }
  }

  async function handleDownloadFormat(formatId: string): Promise<void> {
    if (!pageMedia) return;
    setDownloadingFormatId(formatId);
    setPanelError(undefined);
    setDownloadSuccess(false);
    try {
      const request = buildDownloadRequest({
        media: pageMedia,
        filenameTemplate,
        formatId,
      });
      await window.vidflow.startDownload(request);
      setDownloadSuccess(true);
    } catch (err) {
      setPanelError((err as Error).message);
    } finally {
      setDownloadingFormatId(undefined);
    }
  }

  const sortedFormats = useMemo(() => {
    if (!pageMedia) return [];
    const videos = pageMedia.formats
      .filter((f) => f.kind === 'video')
      .sort((a, b) => (b.kind === 'video' && a.kind === 'video' ? (b.height ?? 0) - (a.height ?? 0) : 0));
    const audios = pageMedia.formats.filter((f) => f.kind === 'audio');
    return [...videos, ...audios];
  }, [pageMedia]);

  const pairedAudio = useMemo(
    () => (pageMedia ? bestAudio(pageMedia.formats) : undefined),
    [pageMedia],
  );

  const canDownloadCurrentPage = URL_PATTERN.test(state.url);
  const activeHost = hostnameOf(state.url);
  const isSiteWhitelisted = activeHost ? settings.adBlockWhitelist.includes(activeHost) : false;
  const isBookmarked = canDownloadCurrentPage && settings.browserBookmarks.some((b) => b.url === state.url);

  function toggleWhitelist() {
    if (!activeHost) return;
    const next = isSiteWhitelisted
      ? settings.adBlockWhitelist.filter((h) => h !== activeHost)
      : [...settings.adBlockWhitelist, activeHost];
    void updateSettings({ adBlockWhitelist: next }).then(() => void window.vidflow.browserReload());
  }

  function toggleBookmark() {
    if (!canDownloadCurrentPage) return;
    const activeTab = state.tabs?.find((t) => t.id === state.activeTabId);
    const title = activeTab?.title || activeHost || state.url;
    const next = isBookmarked
      ? settings.browserBookmarks.filter((b) => b.url !== state.url)
      : [...settings.browserBookmarks, { title, url: state.url }];
    void updateSettings({ browserBookmarks: next });
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-2">
      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-surface-raised px-2 py-1 shadow-sm">
        {(state.tabs ?? []).map((tab) => {
          const active = tab.id === state.activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => void window.vidflow.browserSwitchTab(tab.id)}
              className={`group flex max-w-[190px] cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1 text-xs transition-colors ${
                active ? 'bg-accent/15 font-semibold text-accent' : 'text-content-muted hover:bg-surface-sunken'
              }`}
            >
              <span className="truncate">{tab.title || 'Nueva pestaña'}</span>
              {(state.tabs?.length ?? 0) > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void window.vidflow.browserCloseTab(tab.id);
                  }}
                  className="rounded p-0.5 opacity-70 hover:bg-surface hover:opacity-100"
                  title="Cerrar pestaña"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => void window.vidflow.browserCreateTab()}
          className="rounded-lg p-1.5 text-content-muted hover:bg-surface-sunken hover:text-content"
          title="Nueva pestaña"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Navigation bar */}
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
          {canDownloadCurrentPage && (
            <button
              type="button"
              onClick={toggleBookmark}
              title={isBookmarked ? 'Quitar marcador' : 'Guardar marcador'}
              className="text-content-muted hover:text-amber-400"
            >
              <Star size={14} className={isBookmarked ? 'fill-amber-400 text-amber-400' : ''} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={toggleWhitelist}
          title={
            isSiteWhitelisted
              ? `Escudo pausado en ${activeHost} (clic para activar)`
              : `Escudo activo${activeHost ? ` en ${activeHost}` : ''}: ${state.blockedCount ?? 0} bloqueados (clic para pausar en este sitio)`
          }
          className={`inline-flex items-center gap-1 rounded-card border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            isSiteWhitelisted
              ? 'border-border bg-surface text-content-muted'
              : 'border-amber-500/30 bg-amber-500/12 text-amber-500'
          }`}
        >
          {isSiteWhitelisted ? <ShieldOff size={14} /> : <Shield size={14} />}
          {isSiteWhitelisted ? 'Pausado' : state.blockedCount ?? 0}
        </button>

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

      {/* Bookmarks bar */}
      {settings.browserBookmarks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          {settings.browserBookmarks.map((bm) => (
            <button
              key={bm.url}
              type="button"
              onClick={() => navigate(bm.url)}
              className="max-w-[160px] truncate rounded-md border border-border bg-surface-raised px-2 py-0.5 text-[11px] text-content-muted hover:border-accent/40 hover:text-content"
              title={bm.url}
            >
              ★ {bm.title}
            </button>
          ))}
        </div>
      )}

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
              <div className="flex shrink-0 gap-1.5">
                <Button
                  variant="secondary"
                  onClick={() => void openQuickDownload(item.url, item.referer ?? (state.url || undefined))}
                >
                  <Download size={14} />
                  Calidades
                </Button>
                <Button onClick={() => handleAnalyzeDetected(item)}>Analizar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <div
          ref={containerRef}
          className="min-h-[300px] flex-1 overflow-hidden rounded-xl border border-border bg-surface-sunken shadow-inner"
        />

        {showSidePanel && (
          <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-hidden rounded-xl border border-border bg-surface-raised p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
              <span className="text-sm font-semibold text-content">Descargar video</span>
              <button
                type="button"
                onClick={() => setShowSidePanel(false)}
                className="rounded-md p-1 text-content-muted hover:bg-surface-sunken hover:text-content"
                title="Cerrar panel"
              >
                <PanelRightClose size={16} />
              </button>
            </div>

            {analyzingPage && (
              <div className="flex items-center gap-2.5 py-6 text-xs text-content-muted">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                Analizando calidades y tamaños...
              </div>
            )}

            {panelError && (
              <div className="flex flex-col gap-2 rounded-card border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
                <p>{panelError}</p>
                <Button variant="secondary" onClick={() => void openQuickDownload()}>
                  Reintentar
                </Button>
              </div>
            )}

            {downloadSuccess && (
              <div className="flex items-center justify-between gap-2 rounded-card border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 size={14} />
                  Añadido a la cola
                </span>
                <button
                  type="button"
                  onClick={() => void routerNavigate('/downloads')}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  Ver
                </button>
              </div>
            )}

            {pageMedia && (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p className="line-clamp-2 text-xs font-semibold text-content">
                    {pageMedia.metadata.title}
                  </p>
                  <p className="text-[11px] text-content-muted">
                    {pageMedia.metadata.siteName}
                    {pageMedia.metadata.durationSeconds
                      ? ` · ${formatDuration(pageMedia.metadata.durationSeconds)}`
                      : ''}
                  </p>
                </div>

                <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border bg-surface">
                  {sortedFormats.map((format) => {
                    const extraAudioBytes =
                      format.kind === 'video' && !format.hasAudio ? (pairedAudio?.filesizeBytes ?? 0) : 0;
                    const totalBytes =
                      format.filesizeBytes !== undefined ? format.filesizeBytes + extraAudioBytes : undefined;
                    const isBusy = downloadingFormatId === format.formatId;

                    return (
                      <button
                        key={format.formatId}
                        type="button"
                        disabled={Boolean(downloadingFormatId)}
                        onClick={() => void handleDownloadFormat(format.formatId)}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs transition-colors hover:bg-accent/10 disabled:opacity-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-content">{formatOptionLabel(format)}</p>
                          <p className="text-[11px] text-content-muted">
                            {formatBytes(totalBytes, format.filesizeIsEstimate)}
                          </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-card bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent">
                          <Download size={12} />
                          {isBusy ? '...' : 'Bajar'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {canDownloadCurrentPage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised px-3 py-2 shadow-sm">
          <span className="truncate text-xs text-content-muted">{state.url}</span>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                void routerNavigate('/', {
                  state: { playlistUrl: state.url, referer: state.url },
                })
              }
              title="Extraer todos los videos de esta página o playlist"
            >
              <ListVideo size={15} />
              Extraer lista
            </Button>
            <Button
              onClick={() => void openQuickDownload()}
              disabled={analyzingPage}
              title="Analizar y descargar video de la página actual"
            >
              <Download size={15} />
              {analyzingPage ? 'Analizando...' : 'Descargar video de esta página'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
