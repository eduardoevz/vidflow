import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Rss, Trash2 } from 'lucide-react';
import type { SubscriptionItem } from '../../../shared/ipc-contract';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';

export function SubscriptionsPage(): JSX.Element {
  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const [url, setUrl] = useState('');
  const [preset, setPreset] = useState('best_1080p');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  async function load() {
    setItems(await window.vidflow.listSubscriptions());
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAdd() {
    if (!url.trim()) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await window.vidflow.addSubscription(url.trim(), preset);
      setUrl('');
      await load();
      setNotice('Suscripción añadida. Los nuevos videos se encolarán automáticamente.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckNow() {
    setChecking(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const res = await window.vidflow.checkSubscriptionsNow();
      await load();
      setNotice(`Comprobadas ${res.checked} suscripciones · ${res.queued} videos nuevos encolados.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-content">Suscripciones</h1>
          <p className="text-xs text-content-muted">
            Sigue canales o playlists para descargar automáticamente los videos nuevos.
          </p>
        </div>
        <Button variant="secondary" disabled={checking || items.length === 0} onClick={() => void handleCheckNow()}>
          <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Comprobando...' : 'Comprobar ahora'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-raised p-3 shadow-sm">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleAdd()}
          placeholder="URL de canal o playlist (https://...)"
          className="flex-1 bg-transparent px-2 py-1 text-sm text-content placeholder:text-content-muted focus:outline-none"
        />
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="focus-ring rounded-card border border-border bg-surface px-2.5 py-1.5 text-xs text-content"
        >
          <option value="best">Mejor calidad</option>
          <option value="best_1080p">Hasta 1080p</option>
          <option value="best_720p">Hasta 720p</option>
          <option value="audio_only">Solo audio</option>
        </select>
        <Button onClick={() => void handleAdd()} disabled={busy || !url.trim()}>
          <Plus size={15} />
          {busy ? 'Añadiendo...' : 'Seguir'}
        </Button>
      </div>

      {error && (
        <p className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-500">{error}</p>
      )}
      {notice && (
        <p className="rounded-card border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-500">
          {notice}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<Rss size={26} />}
          title="Sin suscripciones activas"
          description="Añade la URL de un canal o playlist arriba para que VidFlow detecte nuevos videos automáticamente."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-raised p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-content">{sub.title}</p>
                <p className="truncate text-xs text-content-muted">
                  {sub.url} · {sub.seenUrls.length} conocidos · {sub.preset}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-content-muted">
                  <input
                    type="checkbox"
                    checked={sub.enabled}
                    onChange={(e) =>
                      void window.vidflow.toggleSubscription(sub.id, e.target.checked).then(() => void load())
                    }
                    className="accent-accent"
                  />
                  Activa
                </label>
                <Button
                  variant="ghost"
                  onClick={() => void window.vidflow.removeSubscription(sub.id).then(() => void load())}
                  title="Eliminar suscripción"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
