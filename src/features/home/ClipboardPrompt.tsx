import { Link2 } from 'lucide-react';
import { Button } from '../../components/Button';

interface ClipboardPromptProps {
  url: string;
  onAnalyze: () => void;
  onIgnore: () => void;
}

export function ClipboardPrompt({ url, onAnalyze, onIgnore }: ClipboardPromptProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-accent/30 bg-accent/10 px-4 py-3">
      <div className="flex items-center gap-3 overflow-hidden">
        <Link2 size={18} className="shrink-0 text-accent" />
        <div className="overflow-hidden">
          <p className="text-sm font-medium text-content">Se detectó un enlace multimedia</p>
          <p className="truncate text-xs text-content-muted">{url}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" onClick={onIgnore}>
          Ignorar
        </Button>
        <Button onClick={onAnalyze}>Analizar</Button>
      </div>
    </div>
  );
}
