import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';

async function run() {
  const electronApp = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      VIDFLOW_USE_DIST: '1',
    },
  });

  const pageErrors = [];
  try {
    const win = await electronApp.firstWindow();
    win.on('pageerror', (err) => pageErrors.push(err.message));

    await win.waitForLoadState('domcontentloaded');
    await win.waitForSelector('text=VidFlow');

    // 1. Inicio: verify analyzer input & batch mode
    const input = win.locator('textarea[placeholder*="Pega aquí"]');
    await input.waitFor({ state: 'visible' });
    await input.fill('https://example.com/v1\nhttps://example.com/v2');
    const batchBtn = win.locator('button:has-text("Cargar lote (2)")');
    await batchBtn.waitFor({ state: 'visible' });
    await batchBtn.click();
    await win.locator('text=Cola en lote (2 enlaces)').waitFor({ state: 'visible' });

    // 2. Navegador integrado: verify tabs, shields, real navigation & lateral panel
    await win.locator('a[href="#/browser"]').click();
    const addrInput = win.locator('input').first();
    await addrInput.waitFor({ state: 'visible' });
    await addrInput.fill('https://example.com');
    await addrInput.press('Enter');

    const quickDownloadBtn = win.locator('button:has-text("Descargar video de esta página")');
    await quickDownloadBtn.waitFor({ state: 'visible', timeout: 15000 });
    await win.locator('button:has-text("Extraer lista")').waitFor({ state: 'visible' });

    await quickDownloadBtn.click();
    await win.locator('aside >> text=Descargar video').waitFor({ state: 'visible' });
    await win.locator('button[title="Cerrar panel"]').click();

    // 3. Descargas: verify speed limit and post-queue controls
    await win.locator('a[href="#/downloads"]').click();
    await win.locator('h1:has-text("Descargas activas")').waitFor({ state: 'visible' });
    await win.locator('option:has-text("Velocidad: Ilimitada")').waitFor({ state: 'attached' });
    await win.locator('option:has-text("Al terminar: Nada")').waitFor({ state: 'attached' });

    // 4. Suscripciones
    await win.locator('a[href="#/subscriptions"]').click();
    await win.locator('h1:has-text("Suscripciones")').waitFor({ state: 'visible' });

    // 5. Historial
    await win.locator('a[href="#/history"]').click();
    await win.waitForSelector('text=/Historial/');

    // 6. Ajustes: verify synced version 3.0.0 and v2/v3 settings sections
    await win.locator('a[href="#/settings"]').click();
    await win.locator('h1:has-text("Ajustes")').waitFor({ state: 'visible' });
    await win.locator('text=3.0.0').waitFor({ state: 'visible' });
    await win.locator('text=Extensión de Navegador (Bridge Local)').waitFor({ state: 'visible' });
    await win.locator('button:has-text("Buscar nueva versión (GitHub)")').waitFor({ state: 'visible' });

    assert.equal(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.join('; ')}`);
    console.log('E2E PASS: all 6 core VidFlow Electron flows verified with 0 page errors.');
  } finally {
    await electronApp.close();
  }
}

run().catch((err) => {
  console.error('E2E FAIL:', err);
  process.exit(1);
});
