import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Film } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { ClipboardPrompt } from './ClipboardPrompt';
import { UrlAnalyzerSection } from '../analyzer/UrlAnalyzerSection';
import { useSettingsStore } from '../../stores/settingsStore';

const URL_PATTERN = /^https?:\/\/\S+$/i;

export function HomePage(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [externalTarget, setExternalTarget] = useState<{ url: string; referer?: string } | undefined>(undefined);
  const [clipboardCandidate, setClipboardCandidate] = useState<string | undefined>(undefined);
  const [dismissedClipboard, setDismissedClipboard] = useState<string | undefined>(undefined);
  const detectClipboard = useSettingsStore((s) => s.settings.detectClipboard);

  useEffect(() => {
    const navState = location.state as { analyzeUrl?: string; referer?: string } | null;
    if (navState?.analyzeUrl && URL_PATTERN.test(navState.analyzeUrl)) {
      setExternalTarget({ url: navState.analyzeUrl, referer: navState.referer });
      void navigate('.', { replace: true, state: null });
    }
  }, [location.state, navigate]);

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

  return (
    <div className="flex flex-col gap-6">
      {clipboardCandidate && (
        <ClipboardPrompt
          url={clipboardCandidate}
          onAnalyze={() => {
            setExternalTarget({ url: clipboardCandidate });
            setClipboardCandidate(undefined);
          }}
          onIgnore={() => {
            setDismissedClipboard(clipboardCandidate);
            setClipboardCandidate(undefined);
          }}
        />
      )}

      <UrlAnalyzerSection
        title="Pega el enlace de un video"
        externalUrl={externalTarget?.url}
        externalReferer={externalTarget?.referer}
        emptyFallback={
          <EmptyState
            icon={<Film size={28} />}
            title="Ningún video analizado todavía"
            description="Pega un enlace de YouTube, Vimeo, TikTok o cualquier página con video para ver sus calidades y tamaños."
          />
        }
      />
    </div>
  );
}
