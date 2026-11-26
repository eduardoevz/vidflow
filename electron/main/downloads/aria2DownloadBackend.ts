import path from 'node:path';
import { spawnSafe } from '../security/spawnSafe';
import { parseAria2ProgressLine } from './progressParser';

export interface Aria2DownloadHandle {
  cancel: () => void;
}

export interface Aria2DownloadCallbacks {
  onProgress: (downloadedBytes: number, totalBytes?: number, speedBytesPerSec?: number, etaSeconds?: number) => void;
}

export interface Aria2DownloadOptions {
  aria2Path: string;
  url: string;
  destinationPath: string;
  connections: number;
  userAgent?: string;
  referer?: string;
  cookie?: string;
}

/** Multi-connection download via aria2c for the generic/manifest (non-yt-dlp) direct-URL path. */
export function startAria2Download(
  options: Aria2DownloadOptions,
  callbacks: Aria2DownloadCallbacks,
): Promise<void> & { handle: Aria2DownloadHandle } {
  const args = [
    '-x', String(options.connections),
    '-s', String(options.connections),
    '-k', '1M',
    '--file-allocation=none',
    '--summary-interval=1',
    '--console-log-level=notice',
    '--continue=true',
    '--dir', path.dirname(options.destinationPath),
    '--out', path.basename(options.destinationPath),
  ];

  if (options.userAgent) args.push(`--user-agent=${options.userAgent}`);
  if (options.referer) args.push(`--header=Referer: ${options.referer}`);
  if (options.cookie) args.push(`--header=Cookie: ${options.cookie}`);

  args.push(options.url);

  const child = spawnSafe(options.aria2Path, args);
  let stderrTail = '';

  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf-8');
    for (const line of text.split('\n')) {
      const parsed = parseAria2ProgressLine(line);
      if (parsed) {
        callbacks.onProgress(parsed.downloadedBytes, parsed.totalBytes, parsed.speedBytesPerSec, parsed.etaSeconds);
      }
    }
  });

  child.stderr.on('data', (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString('utf-8')).slice(-1000);
  });

  const promise = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolve();
      else if (signal) reject(new Error('cancelled'));
      else reject(new Error(stderrTail.trim() || `aria2c exited with code ${code}`));
    });
  }) as Promise<void> & { handle: Aria2DownloadHandle };

  promise.handle = {
    cancel: () => child.kill(),
  };

  return promise;
}
