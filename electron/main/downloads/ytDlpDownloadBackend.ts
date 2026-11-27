import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { ClipRange } from '../../../shared/download-types';
import { spawnSafe } from '../security/spawnSafe';
import { parseYtDlpProgressLine } from './progressParser';

export interface DownloadBackendCallbacks {
  onProgress: (percent: number, totalBytes?: number, speedBytesPerSec?: number, etaSeconds?: number) => void;
  onMerging: () => void;
}

export interface RunningDownload {
  process: ChildProcessWithoutNullStreams;
  cancel: () => void;
}

export interface YtDlpDownloadOptions {
  ytDlpPath: string;
  ffmpegPath: string;
  url: string;
  formatSelector: string;
  outputTemplate: string;
  mergeOutputFormat: string;
  concurrentFragments: number;
  extractAudioOnly: boolean;
  audioFormat?: string; // e.g. "mp3", "m4a", "opus" when extractAudioOnly
  /** When set, delegates the actual byte-fetching to aria2c for faster, multi-connection downloads. */
  externalDownloader?: { path: string; connections: number };
  cookiesFilePath?: string;
  userAgent?: string;
  referer?: string;
  subtitleLanguages?: string[];
  embedSubtitles?: boolean;
  writeSubtitles?: boolean;
  clipRange?: ClipRange;
  sponsorBlockCategories?: string[];
  maxSpeedKbps?: number;
}

export function buildYtDlpDownloadArgs(options: YtDlpDownloadOptions): string[] {
  const args = [
    '--newline',
    '--no-warnings',
    '--no-playlist',
    '--continue',
    '--concurrent-fragments', String(options.concurrentFragments),
    '--ffmpeg-location', options.ffmpegPath,
    '-o', options.outputTemplate,
  ];

  if (options.cookiesFilePath) args.push('--cookies', options.cookiesFilePath);
  if (options.userAgent) args.push('--user-agent', options.userAgent);
  if (options.referer) args.push('--referer', options.referer);

  if (options.subtitleLanguages && options.subtitleLanguages.length > 0) {
    if (options.writeSubtitles !== false) {
      args.push('--write-subs', '--write-auto-subs');
    }
    args.push('--sub-langs', options.subtitleLanguages.join(','));
    args.push('--sub-format', 'srt/vtt/best');
    if (options.embedSubtitles && !options.extractAudioOnly) {
      args.push('--embed-subs');
    }
  }

  if (options.clipRange) {
    const start = Math.max(0, options.clipRange.startSeconds);
    const end = Math.max(start + 0.1, options.clipRange.endSeconds);
    args.push('--download-sections', `*${start}-${end}`, '--force-keyframes-at-cuts');
  }

  if (options.sponsorBlockCategories && options.sponsorBlockCategories.length > 0) {
    args.push('--sponsorblock-remove', options.sponsorBlockCategories.join(','));
  }

  if (options.maxSpeedKbps && options.maxSpeedKbps > 0) {
    args.push('--limit-rate', `${options.maxSpeedKbps}K`);
  }

  args.push(options.url);

  if (options.extractAudioOnly) {
    args.push('-f', 'bestaudio/best', '--extract-audio');
    if (options.audioFormat) {
      args.push('--audio-format', options.audioFormat);
    }
  } else {
    args.push('-f', options.formatSelector, '--merge-output-format', options.mergeOutputFormat);
  }

  if (options.externalDownloader) {
    args.push('--downloader', options.externalDownloader.path);
    args.push(
      '--downloader-args',
      `aria2c:-x ${options.externalDownloader.connections} -s ${options.externalDownloader.connections} -k 1M`,
    );
  }

  return args;
}

export function startYtDlpDownload(
  options: YtDlpDownloadOptions,
  callbacks: DownloadBackendCallbacks,
): Promise<void> & { handle: RunningDownload } {
  const args = buildYtDlpDownloadArgs(options);

  const child = spawnSafe(options.ytDlpPath, args);
  let stderrTail = '';
  let sawMergeLine = false;

  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf-8');
    for (const line of text.split('\n')) {
      if (line.includes('[Merger]') || line.includes('[ExtractAudio]')) {
        if (!sawMergeLine) {
          sawMergeLine = true;
          callbacks.onMerging();
        }
        continue;
      }
      const parsed = parseYtDlpProgressLine(line);
      if (parsed) {
        callbacks.onProgress(parsed.percent, parsed.totalBytes, parsed.speedBytesPerSec, parsed.etaSeconds);
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
      else reject(new Error(stderrTail.trim() || `yt-dlp exited with code ${code}`));
    });
  }) as Promise<void> & { handle: RunningDownload };

  promise.handle = {
    process: child,
    cancel: () => child.kill(),
  };

  return promise;
}
