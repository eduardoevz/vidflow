import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { SettingsSection, ToggleRow } from './SettingsSection';
import { Button } from '../../components/Button';
import type { AppUpdateInfo, EngineVersions } from '../../../shared/ipc-contract';

export function SettingsPage(): JSX.Element {
  const { settings, update } = useSettingsStore();
  const [versions, setVersions] = useState<EngineVersions | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean | undefined>(undefined);
  const [appUpdate, setAppUpdate] = useState<AppUpdateInfo | undefined>(undefined);
  const [adblockStatus, setAdblockStatus] = useState<string | undefined>(undefined);
  const [whisperStatus, setWhisperStatus] = useState<string | undefined>(undefined);

  useEffect(() => {
    void window.vidflow.getEngineVersions().then(setVersions);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-content">Ajustes</h1>

      <SettingsSection title="General">
        <label className="flex items-center justify-between text-sm text-content">
          Tema
          <select
            value={settings.theme}
            onChange={(e) => void update({ theme: e.target.value as typeof settings.theme })}
            className="focus-ring rounded-card border border-border bg-surface px-2 py-1 text-sm"
          >
            <option value="system">Sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
        <ToggleRow
          label="Iniciar minimizada"
          checked={settings.startMinimized}
          onChange={(v) => void update({ startMinimized: v })}
        />
        <ToggleRow
          label="Detectar portapapeles"
          checked={settings.detectClipboard}
          onChange={(v) => void update({ detectClipboard: v })}
        />
        <ToggleRow
          label="Notificaciones"
          checked={settings.notificationsEnabled}
          onChange={(v) => void update({ notificationsEnabled: v })}
        />
        <label className="flex items-center justify-between text-sm text-content">
          Carpeta de descargas
          <div className="flex items-center gap-2">
            <span className="max-w-[220px] truncate text-xs text-content-muted">{settings.downloadsDirectory}</span>
            <Button
              variant="secondary"
              onClick={() => {
                void window.vidflow.pickDownloadsDirectory().then((dir) => {
                  if (dir) void update({ downloadsDirectory: dir });
                });
              }}
            >
              Elegir
            </Button>
          </div>
        </label>
      </SettingsSection>

      <SettingsSection title="Descargas">
        <label className="flex items-center justify-between text-sm text-content">
          Descargas simultáneas
          <select
            value={settings.concurrentDownloads}
            onChange={(e) => void update({ concurrentDownloads: Number(e.target.value) })}
            className="focus-ring rounded-card border border-border bg-surface px-2 py-1 text-sm"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-content">
          <div className="flex items-center justify-between">
            <span>Plantilla de nombre / subcarpetas</span>
            <input
              value={settings.filenameTemplate}
              onChange={(e) => void update({ filenameTemplate: e.target.value })}
              className="focus-ring w-64 rounded-card border border-border bg-surface px-2 py-1 text-sm"
            />
          </div>
          <span className="text-[11px] text-content-muted">
            Variables: {'{title}'}, {'{author}'}, {'{site}'}, {'{resolution}'}, {'{date}'}. Ejemplo con carpetas: {'{site}/{author}/{title}'}
          </span>
        </label>
        <label className="flex items-center justify-between text-sm text-content">
          Motor de descarga
          <select
            value={settings.downloadEngine}
            onChange={(e) => void update({ downloadEngine: e.target.value as typeof settings.downloadEngine })}
            className="focus-ring rounded-card border border-border bg-surface px-2 py-1 text-sm"
          >
            <option value="ytdlp">yt-dlp (predeterminado)</option>
            <option value="aria2">aria2 (multi-conexión, más rápido)</option>
          </select>
        </label>
        {settings.downloadEngine === 'aria2' && (
          <label className="flex items-center justify-between text-sm text-content">
            Conexiones por descarga
            <select
              value={settings.connectionsPerDownload}
              onChange={(e) => void update({ connectionsPerDownload: Number(e.target.value) })}
              className="focus-ring rounded-card border border-border bg-surface px-2 py-1 text-sm"
            >
              {[1, 2, 4, 8, 16].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </SettingsSection>

      <SettingsSection title="Navegador">
        <ToggleRow
          label="Bloqueo de anuncios"
          checked={settings.adBlockEnabled}
          onChange={(v) => void update({ adBlockEnabled: v })}
        />
        <ToggleRow
          label="Bloqueo de trackers"
          checked={settings.trackerBlockEnabled}
          onChange={(v) => void update({ trackerBlockEnabled: v })}
        />
        <ToggleRow
          label="Bloqueo de popups"
          checked={settings.popupBlockEnabled}
          onChange={(v) => void update({ popupBlockEnabled: v })}
        />
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-content-muted">
            {adblockStatus ?? 'Listas dinámicas estilo EasyList / Peter Lowe'}
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              setAdblockStatus('Actualizando listas...');
              void window.vidflow
                .browserUpdateAdBlockLists()
                .then((res) => setAdblockStatus(`Lista actualizada (${res.count} dominios)`))
                .catch((err: Error) => setAdblockStatus(err.message));
            }}
          >
            Actualizar listas EasyList
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Post-procesamiento y SponsorBlock">
        <ToggleRow
          label="Activar SponsorBlock por defecto"
          checked={settings.sponsorBlockEnabled}
          onChange={(v) => void update({ sponsorBlockEnabled: v })}
        />
        <label className="flex items-center justify-between text-sm text-content">
          Categorías a omitir
          <input
            value={settings.sponsorBlockCategories.join(', ')}
            onChange={(e) =>
              void update({
                sponsorBlockCategories: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="sponsor, selfpromo"
            className="focus-ring w-56 rounded-card border border-border bg-surface px-2 py-1 text-sm"
          />
        </label>
      </SettingsSection>

      <SettingsSection title="Extensión de Navegador (Bridge Local)">
        <ToggleRow
          label="Habilitar conexión con extensión (127.0.0.1)"
          checked={settings.extensionBridgeEnabled}
          onChange={(v) => void update({ extensionBridgeEnabled: v })}
        />
        <div className="flex items-center justify-between text-sm text-content">
          <span>Puerto local</span>
          <span className="font-mono text-xs text-content-muted">{settings.extensionBridgePort}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm text-content">
          <span>Token de emparejamiento</span>
          <div className="flex items-center gap-2">
            <code className="max-w-[180px] truncate rounded bg-surface-sunken px-2 py-1 text-xs text-content-muted">
              {settings.extensionBridgeToken || 'Generando...'}
            </code>
            <Button
              variant="secondary"
              onClick={() => {
                if (settings.extensionBridgeToken) {
                  void window.vidflow.copyToClipboard(settings.extensionBridgeToken);
                }
              }}
            >
              Copiar
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Al cerrar">
        <div className="flex flex-col gap-2 text-sm text-content">
          {(['ask', 'minimize', 'quit'] as const).map((option) => (
            <label key={option} className="flex items-center gap-2">
              <input
                type="radio"
                name="closeBehavior"
                checked={settings.closeBehavior === option}
                onChange={() => void update({ closeBehavior: option })}
                className="accent-accent"
              />
              {option === 'ask' ? 'Preguntar' : option === 'minimize' ? 'Minimizar a bandeja' : 'Cerrar aplicación'}
            </label>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Herramientas">
        <div className="grid grid-cols-2 gap-2 text-sm text-content-muted">
          <span>Versión de la app</span>
          <span className="text-content">{versions?.app ?? '—'}</span>
          <span>yt-dlp</span>
          <span className="text-content">{versions?.ytDlp ?? 'No detectado'}</span>
          <span>FFmpeg</span>
          <span className="text-content">{versions?.ffmpeg ?? 'No detectado'}</span>
          <span>aria2</span>
          <span className="text-content">{versions?.aria2 ?? 'No detectado'}</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={checking}
            onClick={() => {
              void (async () => {
                setChecking(true);
                try {
                  const result = await window.vidflow.checkForEngineUpdates();
                  setUpdateAvailable(result.ytDlpUpdateAvailable);
                } finally {
                  setChecking(false);
                }
              })();
            }}
          >
            Comprobar actualizaciones
          </Button>
          {updateAvailable && (
            <Button
              onClick={() => {
                void (async () => {
                  await window.vidflow.updateYtDlp();
                  setVersions(await window.vidflow.getEngineVersions());
                  setUpdateAvailable(false);
                })();
              }}
            >
              Actualizar motor
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setWhisperStatus('Descargando Whisper.cpp...');
              void window.vidflow
                .installWhisper()
                .then(() => setWhisperStatus('Whisper offline instalado'))
                .catch((err: Error) => setWhisperStatus(err.message));
            }}
          >
            Instalar Whisper offline
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void window.vidflow.checkAppUpdate().then(setAppUpdate);
            }}
          >
            Buscar nueva versión (GitHub)
          </Button>
        </div>
        {whisperStatus && <p className="text-xs text-content-muted">{whisperStatus}</p>}
        {appUpdate && (
          <div className="flex items-center justify-between rounded-card border border-border bg-surface p-2.5 text-xs">
            <span>
              {appUpdate.updateAvailable
                ? `Nueva versión disponible: ${appUpdate.latestVersion}`
                : `VidFlow está actualizado (${appUpdate.latestVersion ?? 'v2'})`}
            </span>
            {appUpdate.updateAvailable && appUpdate.releaseUrl && (
              <Button onClick={() => void window.vidflow.openExternal(appUpdate.releaseUrl!)}>
                Descargar en GitHub
              </Button>
            )}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
