import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import type { IncomingMessage } from 'node:http';

export interface HttpDownloadHandle {
  cancel: () => void;
}

export interface HttpDownloadCallbacks {
  onProgress: (downloadedBytes: number, totalBytes?: number, speedBytesPerSec?: number) => void;
}

/** Simple resumable HTTP(S) download for direct-media / manifest-derived formats. */
export function startHttpDownload(
  url: string,
  destinationPath: string,
  callbacks: HttpDownloadCallbacks,
): Promise<void> & { handle: HttpDownloadHandle } {
  let cancelled = false;
  let request: ReturnType<typeof https.get> | undefined;

  const alreadyDownloaded = fs.existsSync(destinationPath) ? fs.statSync(destinationPath).size : 0;

  const promise = new Promise<void>((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const headers: Record<string, string> = { 'User-Agent': 'VidFlow' };
    if (alreadyDownloaded > 0) {
      headers.Range = `bytes=${alreadyDownloaded}-`;
    }

    request = client.get(url, { headers }, (res: IncomingMessage) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const resumed = res.statusCode === 206;
      const totalBytes = res.headers['content-length']
        ? Number(res.headers['content-length']) + (resumed ? alreadyDownloaded : 0)
        : undefined;

      const fileStream = fs.createWriteStream(destinationPath, { flags: resumed ? 'a' : 'w' });
      let downloaded = resumed ? alreadyDownloaded : 0;
      let lastEmit = Date.now();
      let bytesSinceLastEmit = 0;

      res.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        bytesSinceLastEmit += chunk.length;
        const now = Date.now();
        if (now - lastEmit > 200) {
          const speed = (bytesSinceLastEmit / (now - lastEmit)) * 1000;
          callbacks.onProgress(downloaded, totalBytes, speed);
          lastEmit = now;
          bytesSinceLastEmit = 0;
        }
      });

      res.pipe(fileStream);
      fileStream.on('finish', () => {
        if (!cancelled) {
          callbacks.onProgress(downloaded, totalBytes);
          resolve();
        }
      });
      fileStream.on('error', reject);
      res.on('error', reject);
    });
    request.on('error', (err) => {
      if (!cancelled) reject(err);
    });
  }) as Promise<void> & { handle: HttpDownloadHandle };

  promise.handle = {
    cancel: () => {
      cancelled = true;
      request?.destroy();
    },
  };

  return promise;
}
