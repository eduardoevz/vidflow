import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, ExternalLink } from 'lucide-react';
import { Button } from '../../components/Button';
import type { BrowserNavigationState } from '../../../shared/ipc-contract';

const URL_PATTERN = /^https?:\/\/\S+$/i;

export function BrowserPage(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [addressBar, setAddressBar] = useState('https://');
  const [state, setState] = useState<BrowserNavigationState>({
    url: '',
    canGoBack: false,
    canGoForward: false,
    isLoading: false,
  });

  useEffect(() => {
    const unsubscribe = window.vidflow.onBrowserNavigationState((s) => {
      setState(s);
      setAddressBar(s.url || 'https://');
    });
    void window.vidflow.browserSetVisible(true);
    return () => {
      unsubscribe();
      void window.vidflow.browserSetVisible(false);
    };
  }, []);

  useEffect(() => {
    function updateBounds() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      void window.vidflow.browserSetBounds({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
    updateBounds();
    window.addEventListener('resize', updateBounds);
    const interval = setInterval(updateBounds, 400);
    return () => {
      window.removeEventListener('resize', updateBounds);
      clearInterval(interval);
    };
  }, []);

  function navigate(): void {
    const target = URL_PATTERN.test(addressBar) ? addressBar : `https://${addressBar}`;
    void window.vidflow.browserNavigate(target);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" disabled={!state.canGoBack} onClick={() => void window.vidflow.browserBack()}>
          <ArrowLeft size={16} />
        </Button>
        <Button variant="ghost" disabled={!state.canGoForward} onClick={() => void window.vidflow.browserForward()}>
          <ArrowRight size={16} />
        </Button>
        <Button variant="ghost" onClick={() => void window.vidflow.browserReload()}>
          <RotateCw size={16} className={state.isLoading ? 'animate-spin' : ''} />
        </Button>
        <input
          value={addressBar}
          onChange={(e) => setAddressBar(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && navigate()}
          className="focus-ring flex-1 rounded-card border border-border bg-surface-raised px-3 py-2 text-sm text-content"
        />
        <Button variant="ghost" title="Abrir externamente" onClick={() => void window.vidflow.openExternal(state.url)}>
          <ExternalLink size={16} />
        </Button>
      </div>
      <div ref={containerRef} className="min-h-[400px] flex-1 rounded-card border border-border bg-surface-sunken" />
    </div>
  );
}
