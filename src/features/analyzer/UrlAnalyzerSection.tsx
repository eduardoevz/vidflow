import { useEffect, useState } from 'react';
import { Clipboard, Link2, Search, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { AnalyzerResult } from './AnalyzerResult';
import { ERROR_TITLES } from './errorMessages';
import { useAnalyze } from './useAnalyze';

const URL_PATTERN = /^https?:\/\/\S+$/i;

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

  useEffect(() => {
    if (externalUrl && URL_PATTERN.test(externalUrl)) {
      setUrl(externalUrl);
      setReferer(externalReferer);
      void analyze(externalUrl, externalReferer ? { referer: externalReferer } : undefined);
    }
  }, [externalUrl, externalReferer, analyze]);

  function handleSubmit(): void {
    if (!URL_PATTERN.test(url.trim())) return;
    void analyze(url.trim(), referer ? { referer } : undefined);
  }

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
            placeholder="Pega aquí el enlace del video (https://...)"
            className="flex-1 bg-transparent px-2 py-1.5 text-sm text-content placeholder:text-content-muted focus:outline-none"
          />
          {url && (
            <Button
              variant="ghost"
              onClick={() => {
                setUrl('');
                setReferer(undefined);
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
          <Button onClick={handleSubmit} disabled={loading || !URL_PATTERN.test(url.trim())}>
            <Search size={15} />
            {loading ? 'Analizando...' : 'Analizar'}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3.5 text-sm text-content-muted shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Analizando calidades y tamaños disponibles...
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4">
          <p className="text-sm font-semibold text-content">{ERROR_TITLES[error.code]}</p>
          {error.suggestion && <p className="text-sm text-content-muted">{error.suggestion}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void analyze(url.trim(), referer ? { referer } : undefined)}>
              Reintentar
            </Button>
            <Button variant="ghost" onClick={reset}>
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

      {!media && !error && !loading && emptyFallback}
    </div>
  );
}
