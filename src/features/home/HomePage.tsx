import { useEffect, useState } from 'react';
import { Clipboard, Search, Film } from 'lucide-react';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ClipboardPrompt } from './ClipboardPrompt';
import { AnalyzerResult } from '../analyzer/AnalyzerResult';
import { ERROR_TITLES } from '../analyzer/errorMessages';
import { useAnalyze } from '../analyzer/useAnalyze';
import { useSettingsStore } from '../../stores/settingsStore';

const URL_PATTERN = /^https?:\/\/\S+$/i;

export function HomePage(): JSX.Element {
  const [url, setUrl] = useState('');
  const [clipboardCandidate, setClipboardCandidate] = useState<string | undefined>(undefined);
  const [dismissedClipboard, setDismissedClipboard] = useState<string | undefined>(undefined);
  const { loading, media, error, analyze, reset } = useAnalyze();
  const detectClipboard = useSettingsStore((s) => s.settings.detectClipboard);

  useEffect(() => {
    if (!detectClipboard) return;
    let cancelled = false;
    const check = async () => {
      const text = await window.vidflow.readClipboard();
      if (!cancelled && URL_PATTERN.test(text.trim()) && text.trim() !== dismissedClipboard) {
        setClipboardCandidate(text.trim());
      }
    };
    void check();
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [detectClipboard, dismissedClipboard]);

  function handleSubmit(): void {
    if (!URL_PATTERN.test(url.trim())) return;
    void analyze(url.trim());
  }

  return (
    <div className="flex flex-col gap-6">
      {clipboardCandidate && (
        <ClipboardPrompt
          url={clipboardCandidate}
          onAnalyze={() => {
            setUrl(clipboardCandidate);
            void analyze(clipboardCandidate);
            setClipboardCandidate(undefined);
          }}
          onIgnore={() => {
            setDismissedClipboard(clipboardCandidate);
            setClipboardCandidate(undefined);
          }}
        />
      )}

      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-content">Pega el enlace de un video</h1>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="https://..."
            className="focus-ring flex-1 rounded-card border border-border bg-surface-raised px-4 py-2.5 text-sm text-content placeholder:text-content-muted"
          />
          <Button
            variant="secondary"
            onClick={() => {
              void window.vidflow.readClipboard().then((text) => setUrl(text.trim()));
            }}
            title="Pegar"
          >
            <Clipboard size={16} />
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Search size={16} />
            Analizar
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3 rounded-card border border-border px-4 py-3 text-sm text-content-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Analizando...
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-3 rounded-card border border-red-500/30 bg-red-500/10 px-4 py-4">
          <p className="text-sm font-semibold text-content">{ERROR_TITLES[error.code]}</p>
          {error.suggestion && <p className="text-sm text-content-muted">{error.suggestion}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void analyze(url.trim())}>
              Reintentar
            </Button>
            <Button variant="ghost" onClick={reset}>
              Descartar
            </Button>
          </div>
        </div>
      )}

      {media && <AnalyzerResult media={media} onDownloadStarted={() => undefined} />}

      {!media && !error && !loading && (
        <EmptyState
          icon={<Film size={28} />}
          title="Ningún video analizado todavía"
          description="Pega un enlace de YouTube, Vimeo, TikTok o cualquier página con video para empezar."
        />
      )}
    </div>
  );
}
