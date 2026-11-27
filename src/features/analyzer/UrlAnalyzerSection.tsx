import { useEffect, useState } from 'react';
import { Clipboard, Link2, ListVideo, Search, X } from 'lucide-react';
import type { AnalysisError, PlaylistInfo } from '../../../shared/media-types';
import { Button } from '../../components/Button';
import { AnalyzerResult } from './AnalyzerResult';
import { PlaylistResult } from './PlaylistResult';
import { ERROR_TITLES } from './errorMessages';
import { useAnalyze } from './useAnalyze';

const URL_PATTERN = /^https?:\/\/\S+$/i;

function extractUrls(raw: string): string[] {
  return raw
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter((line) => URL_PATTERN.test(line));
}

function looksLikePlaylistUrl(raw: string): boolean {
  return /[?&]list=|\/playlist\b|\/videos\b|\/channel\b/i.test(raw);
}

interface UrlAnalyzerSectionProps {
  title: string;
  externalUrl?: string;
  externalReferer?: string;
  onDownloadStarted?: () => void;
  emptyFallback?: JSX.Element;
}

export function UrlAnalyzerSection({
  title,
  externalUrl,
  externalReferer,
  onDownloadStarted,
  emptyFallback,
}: UrlAnalyzerSectionProps): JSX.Element {
  const [url, setUrl] = useState(externalUrl ?? '');
  const [referer, setReferer] = useState<string | undefined>(externalReferer);
  const { loading, media, error, analyze, reset } = useAnalyze();
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlist, setPlaylist] = useState<PlaylistInfo | undefined>(undefined);
  const [playlistError, setPlaylistError] = useState<AnalysisError | undefined>(undefined);

  useEffect(() => {
    if (externalUrl && URL_PATTERN.test(externalUrl)) {
      setUrl(externalUrl);
      setReferer(externalReferer);
      setPlaylist(undefined);
      setPlaylistError(undefined);
      void analyze(externalUrl, externalReferer ? { referer: externalReferer } : undefined);
    }
  }, [externalUrl, externalReferer, analyze]);

  async function analyzeAsPlaylist(targetUrl: string) {
    reset();
    setPlaylist(undefined);
    setPlaylistError(undefined);
    setPlaylistLoading(true);
    try {
      const res = await window.vidflow.analyzePlaylist(targetUrl, referer ? { referer } : undefined);
      if (res.ok) setPlaylist(res.data);
      else setPlaylistError(res.error);
    } catch (err) {
      setPlaylistError({ code: 'unknown', message: (err as Error).message });
    } finally {
      setPlaylistLoading(false);
    }
  }

  function handleSubmit(): void {
    const urls = extractUrls(url);
    const first = urls[0];
    if (!first) return;

    if (urls.length > 1) {
      reset();
      setPlaylistError(undefined);
      setPlaylist({
        title: `Cola en lote (${urls.length} enlaces)`,
        originalUrl: first,
        entries: urls.map((u, idx) => ({
          id: `${idx}-${u}`,
          title: u,
          url: u,
        })),
      });
      return;
    }

    if (looksLikePlaylistUrl(first) && !/[?&]v=/.test(first)) {
      void analyzeAsPlaylist(first);
      return;
    }

    setPlaylist(undefined);
    setPlaylistError(undefined);
    void analyze(first, referer ? { referer } : undefined);
  }

  const urlsInInput = extractUrls(url);
  const firstInputUrl = urlsInInput[0];
  const isBusy = loading || playlistLoading;
  const activeError = error ?? playlistError;
  const canAnalyzePlaylist = urlsInInput.length === 1 && firstInputUrl !== undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xl font-semibold tracking-tight text-content">{title}</h2>
        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised p-1.5 shadow-sm transition-all focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/15">
          <span className="pl-2.5 text-content-muted">
            <Link2 size={16} />
          </span>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setReferer(undefined);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Pega aquí uno o varios enlaces (o una playlist)..."
            className="flex-1 bg-transparent px-2 py-1.5 text-sm text-content placeholder:text-content-muted focus:outline-none"
          />
          {url && (
            <Button
              variant="ghost"
              onClick={() => {
                setUrl('');
                setReferer(undefined);
                setPlaylist(undefined);
                setPlaylistError(undefined);
                reset();
              }}
              title="Limpiar enlace"
              className="px-2"
            >
              <X size={15} />
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              void window.vidflow.readClipboard().then((text) => {
                setUrl(text.trim());
                setReferer(undefined);
              });
            }}
            title="Pegar del portapapeles"
          >
            <Clipboard size={15} />
            Pegar
          </Button>
          {canAnalyzePlaylist && firstInputUrl && (
            <Button
              variant="secondary"
              onClick={() => void analyzeAsPlaylist(firstInputUrl)}
              disabled={isBusy}
              title="Analizar toda la playlist"
            >
              <ListVideo size={15} />
              Playlist
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isBusy || urlsInInput.length === 0}>
            <Search size={15} />
            {isBusy ? 'Analizando...' : urlsInInput.length > 1 ? `Cargar lote (${urlsInInput.length})` : 'Analizar'}
          </Button>
        </div>
      </div>

      {isBusy && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3.5 text-sm text-content-muted shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          {playlistLoading ? 'Extrayendo lista de reproducción...' : 'Analizando calidades y tamaños disponibles...'}
        </div>
      )}

      {activeError && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4">
          <p className="text-sm font-semibold text-content">{ERROR_TITLES[activeError.code]}</p>
          {activeError.suggestion && <p className="text-sm text-content-muted">{activeError.suggestion}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleSubmit}>
              Reintentar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                reset();
                setPlaylistError(undefined);
              }}
            >
              Descartar
            </Button>
          </div>
        </div>
      )}

      {media && (
        <AnalyzerResult
          media={media}
          onDownloadStarted={() => {
            onDownloadStarted?.();
          }}
        />
      )}

      {playlist && (
        <PlaylistResult
          playlist={playlist}
          onDownloadStarted={() => {
            onDownloadStarted?.();
          }}
        />
      )}

      {!media && !playlist && !activeError && !isBusy && emptyFallback}
    </div>
  );
}
