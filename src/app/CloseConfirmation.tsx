import { useEffect, useState } from 'react';
import { Button } from '../components/Button';

export function CloseConfirmation(): JSX.Element | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return window.vidflow.onRequestCloseConfirmation(() => setVisible(true));
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-card border border-border bg-surface-raised p-5">
        <p className="text-sm font-semibold text-content">¿Cerrar VidFlow?</p>
        <p className="text-sm text-content-muted">
          Hay una ventana abierta. Puedes minimizar a la bandeja para mantener las descargas activas, o cerrar la
          aplicación por completo.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setVisible(false);
              void window.vidflow.minimizeToTray();
            }}
          >
            Minimizar a bandeja
          </Button>
          <Button variant="danger" onClick={() => void window.vidflow.confirmQuit()}>
            Cerrar aplicación
          </Button>
        </div>
      </div>
    </div>
  );
}
