import { describe, it, expect, afterEach, vi } from 'vitest';
import { ExtensionBridgeServer } from '../../electron/main/bridge/extensionBridgeServer';

describe('ExtensionBridgeServer', () => {
  let server: ExtensionBridgeServer | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
  });

  it('rejects unauthorized requests and accepts valid capture payloads', async () => {
    const onCapture = vi.fn();
    server = new ExtensionBridgeServer({
      port: 0,
      getToken: () => 'secret-token-123',
      getAppVersion: () => '0.1.0',
      onCapture,
    });
    const port = await server.start();
    const base = `http://127.0.0.1:${port}`;

    const unauth = await fetch(`${base}/api/ping`);
    expect(unauth.status).toBe(401);

    const ping = await fetch(`${base}/api/ping`, {
      headers: { 'X-VidFlow-Token': 'secret-token-123' },
    });
    expect(ping.status).toBe(200);
    expect(await ping.json()).toEqual({ ok: true, version: '0.1.0' });

    const bad = await fetch(`${base}/api/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VidFlow-Token': 'secret-token-123',
      },
      body: JSON.stringify({ url: 'not-a-url' }),
    });
    expect(bad.status).toBe(400);

    const good = await fetch(`${base}/api/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VidFlow-Token': 'secret-token-123',
      },
      body: JSON.stringify({
        url: 'https://example.com/video.mp4',
        pageUrl: 'https://example.com/watch',
        title: 'Demo',
      }),
    });
    expect(good.status).toBe(200);
    expect(onCapture).toHaveBeenCalledWith({
      url: 'https://example.com/video.mp4',
      pageUrl: 'https://example.com/watch',
      title: 'Demo',
    });
  });
});
