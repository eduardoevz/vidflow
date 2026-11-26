import fs from 'node:fs';
import path from 'node:path';
import type { DownloadProgress, DownloadRecord, DownloadRequest, DownloadStatus } from '../../../shared/download-types';
import type { DownloadEngine } from '../../../shared/settings-types';
import type { DownloadsRepo } from '../database/downloadsRepo';
import type { HistoryRepo } from '../database/historyRepo';
import type { MediaItemsRepo } from '../database/mediaItemsRepo';
import { renderFilenameTemplate, resolveCollisionFreePath } from './filenameTemplate';
import { startYtDlpDownload, type RunningDownload } from './ytDlpDownloadBackend';
import { startHttpDownload, type HttpDownloadHandle } from './httpDownloadBackend';
import { startAria2Download, type Aria2DownloadHandle } from './aria2DownloadBackend';
import { extractAudio } from './ffmpegMerger';
import { getLogger } from '../logging/logger';

interface Task {
  id: string;
  downloadId: number;
  request: DownloadRequest;
  status: DownloadStatus;
  progressPercent: number;
  downloadedBytes: number;
  totalBytes?: number;
  destinationPath: string;
  handle?: RunningDownload | HttpDownloadHandle | Aria2DownloadHandle;
  lastEmitAt: number;
}

export interface DownloadManagerDeps {
  downloadsRepo: DownloadsRepo;
  historyRepo: HistoryRepo;
  mediaItemsRepo: MediaItemsRepo;
  getDownloadsDirectory: () => string;
  getConcurrency: () => number;
  getYtDlpPath: () => string;
  getFfmpegPath: () => string;
  getDownloadEngine: () => DownloadEngine;
  getConnectionsPerDownload: () => number;
  /** undefined when aria2 isn't installed/available — callers must fall back to yt-dlp native. */
  getAria2Path: () => string | undefined;
  prepareSessionContext?: (targetUrl: string) => Promise<{
    cookiesFilePath?: string;
    cookieHeader?: string;
    userAgent?: string;
    cleanup: () => void;
  }>;
  onProgress: (progress: DownloadProgress) => void;
}

const PROGRESS_EMIT_INTERVAL_MS = 200;

export class DownloadManager {
  private readonly tasks = new Map<string, Task>();
  private readonly queue: string[] = [];
  private activeCount = 0;

  constructor(private readonly deps: DownloadManagerDeps) {}

  start(request: DownloadRequest): string {
    const mediaItemId = this.deps.mediaItemsRepo.insert({
      originalUrl: request.originalUrl,
      title: request.title,
      source: request.source,
      durationSeconds: request.durationSeconds,
    });

    const downloadId = this.deps.downloadsRepo.insert({
      mediaItemId,
      formatId: request.formatId,
      resolution: request.resolutionLabel,
      format: request.extension,
      filesizeBytes: request.filesizeBytes,
      filesizeIsEstimate: request.filesizeIsEstimate,
    });

    const filenameBase = renderFilenameTemplate(request.filenameTemplate, {
      title: request.title,
      resolution: request.resolutionLabel,
    });
    const destinationPath = resolveCollisionFreePath(
      this.deps.getDownloadsDirectory(),
      filenameBase,
      request.extension,
    );

    // The DB download id doubles as the task id, so persisted DownloadRecord.id
    // and in-memory progress events always refer to the same identifier —
    // the renderer never has to correlate two different id spaces.
    const taskId = String(downloadId);
    this.tasks.set(taskId, {
      id: taskId,
      downloadId,
      request,
      status: 'queued',
      progressPercent: 0,
      downloadedBytes: 0,
      destinationPath,
      lastEmitAt: 0,
    });
    this.queue.push(taskId);
    this.pump();
    return taskId;
  }

  private pump(): void {
    const concurrency = this.deps.getConcurrency();
    while (this.activeCount < concurrency && this.queue.length > 0) {
      const taskId = this.queue.shift();
      if (!taskId) break;
      const task = this.tasks.get(taskId);
      if (!task || task.status === 'cancelled') continue;
      this.activeCount += 1;
      void this.runTask(task).finally(() => {
        this.activeCount -= 1;
        this.pump();
      });
    }
  }

  private emit(task: Task, extra: Partial<DownloadProgress> = {}): void {
    const now = Date.now();
    const isTerminal = ['completed', 'failed', 'cancelled'].includes(task.status);
    if (!isTerminal && now - task.lastEmitAt < PROGRESS_EMIT_INTERVAL_MS) return;
    task.lastEmitAt = now;
    this.deps.onProgress({
      taskId: task.id,
      title: task.request.title,
      resolutionLabel: task.request.resolutionLabel,
      status: task.status,
      progressPercent: task.progressPercent,
      downloadedBytes: task.downloadedBytes,
      totalBytes: task.totalBytes,
      ...extra,
    });
  }

  private async runTask(task: Task): Promise<void> {
    const logger = getLogger();
    task.status = 'downloading';
    this.deps.downloadsRepo.updateProgress(task.downloadId, 'downloading', 0);
    this.emit(task);

    const engine = this.deps.getDownloadEngine();
    const aria2Path = engine === 'aria2' ? this.deps.getAria2Path() : undefined;
    if (engine === 'aria2' && !aria2Path) {
      logger.warn('downloadManager', 'aria2 seleccionado pero no disponible; usando el motor nativo de yt-dlp', {
        taskId: task.id,
      });
    }

    const targetUrl = task.request.useYtDlp
      ? task.request.originalUrl
      : (task.request.downloadUrl ?? task.request.originalUrl);
    const sessionCtx = this.deps.prepareSessionContext
      ? await this.deps.prepareSessionContext(targetUrl).catch(() => undefined)
      : undefined;

    try {
      const isManifestStream =
        !task.request.useYtDlp &&
        (task.request.protocol === 'hls' || task.request.protocol === 'dash');

      if (task.request.useYtDlp || isManifestStream) {
        const formatSelector = task.request.useYtDlp
          ? task.request.audioFormatId
            ? `${task.request.formatId}+${task.request.audioFormatId}`
            : task.request.formatId
          : 'bestvideo+bestaudio/best';

        const download = startYtDlpDownload(
          {
            ytDlpPath: this.deps.getYtDlpPath(),
            ffmpegPath: this.deps.getFfmpegPath(),
            url: task.request.useYtDlp ? task.request.originalUrl : (task.request.downloadUrl ?? task.request.originalUrl),
            formatSelector,
            outputTemplate: task.destinationPath,
            mergeOutputFormat: task.request.extension,
            concurrentFragments: 4,
            extractAudioOnly: task.request.audioOnly,
            audioFormat: task.request.audioOnly ? task.request.extension : undefined,
            cookiesFilePath: sessionCtx?.cookiesFilePath,
            userAgent: sessionCtx?.userAgent,
            referer: task.request.referer,
            externalDownloader: aria2Path
              ? { path: aria2Path, connections: this.deps.getConnectionsPerDownload() }
              : undefined,
          },
          {
            onProgress: (percent, totalBytes, speed, eta) => {
              task.progressPercent = percent;
              task.totalBytes = totalBytes;
              if (totalBytes) task.downloadedBytes = Math.round((percent / 100) * totalBytes);
              this.deps.downloadsRepo.updateProgress(task.downloadId, 'downloading', percent);
              this.emit(task, { speedBytesPerSec: speed, etaSeconds: eta });
            },
            onMerging: () => {
              task.status = 'merging';
              this.deps.downloadsRepo.updateProgress(task.downloadId, 'merging', task.progressPercent);
              this.emit(task);
            },
          },
        );
        task.handle = download.handle;
        await download;

        // yt-dlp exits 0 even when it silently skipped merging (e.g. FFmpeg
        // missing from the --ffmpeg-location it was given) — it just leaves
        // the separate .fXXX fragment files instead of the merged output.
        // Trusting the exit code alone would report a broken download as
        // "completed" pointing at a file that doesn't exist.
        if (!fs.existsSync(task.destinationPath)) {
          this.cleanupYtDlpFragments(task.destinationPath);
          throw new Error(
            task.request.audioFormatId
              ? 'La descarga terminó pero no se pudo combinar video y audio (¿falta FFmpeg?).'
              : 'La descarga terminó pero el archivo final no se encontró.',
          );
        }
      } else {
        if (!task.request.downloadUrl) {
          throw new Error('downloadUrl es requerido para descargas fuera de yt-dlp');
        }
        // audioOnly requests against a non-yt-dlp source download the raw
        // media first, then extract audio into the real destination with
        // FFmpeg — generic/manifest formats never expose an audio-only URL
        // directly, unlike yt-dlp sources.
        const rawTarget = task.request.audioOnly ? `${task.destinationPath}.source` : task.destinationPath;
        const onHttpProgress = (downloaded: number, total?: number, speed?: number, eta?: number) => {
          task.downloadedBytes = downloaded;
          task.totalBytes = total;
          task.progressPercent = total ? (downloaded / total) * 100 : 0;
          this.deps.downloadsRepo.updateProgress(task.downloadId, 'downloading', task.progressPercent);
          this.emit(task, { speedBytesPerSec: speed, etaSeconds: eta });
        };
        const download = aria2Path
          ? startAria2Download(
              {
                aria2Path,
                url: task.request.downloadUrl,
                destinationPath: rawTarget,
                connections: this.deps.getConnectionsPerDownload(),
                userAgent: sessionCtx?.userAgent,
                referer: task.request.referer,
                cookie: sessionCtx?.cookieHeader,
              },
              { onProgress: onHttpProgress },
            )
          : startHttpDownload(
              task.request.downloadUrl,
              rawTarget,
              { onProgress: onHttpProgress },
              {
                userAgent: sessionCtx?.userAgent,
                referer: task.request.referer,
                cookie: sessionCtx?.cookieHeader,
              },
            );
        task.handle = download.handle;
        await download;

        if (task.request.audioOnly) {
          task.status = 'processing';
          this.deps.downloadsRepo.updateProgress(task.downloadId, 'processing', 100);
          this.emit(task);
          const codec = task.request.extension === 'mp3' ? 'libmp3lame' : 'copy';
          await extractAudio(this.deps.getFfmpegPath(), rawTarget, task.destinationPath, codec);
          fs.unlinkSync(rawTarget);
        }
      }

      task.status = 'completed';
      task.progressPercent = 100;
      this.deps.downloadsRepo.markCompleted(task.downloadId, task.destinationPath);
      const download = this.deps.downloadsRepo.findById(task.downloadId);
      if (download) {
        this.deps.historyRepo.insert({
          mediaItemId: download.mediaItemId,
          downloadId: download.id,
          localPath: task.destinationPath,
          resolution: download.resolution,
          format: download.format,
          filesizeBytes: task.totalBytes ?? download.filesizeBytes,
        });
      }
      this.emit(task);
    } catch (err) {
      // pause() kills the same underlying process as cancel(), and already
      // persisted 'paused' synchronously before doing so — so a rejection
      // here while still marked 'paused' is an intentional pause, not a
      // cancellation or failure. Must be checked before inspecting the
      // error message, which looks identical for both cases.
      if ((task.status as DownloadStatus) === 'paused') {
        this.emit(task);
        return;
      }

      const message = (err as Error).message;
      if (message === 'cancelled') {
        task.status = 'cancelled';
        this.deps.downloadsRepo.updateProgress(task.downloadId, 'cancelled', task.progressPercent);
        this.cleanupPartialFile(task.destinationPath);
      } else {
        logger.error('downloadManager', 'Download failed', { taskId: task.id, error: message });
        task.status = 'failed';
        this.deps.downloadsRepo.markFailed(task.downloadId, message);
      }
      this.emit(task, { errorMessage: task.status === 'failed' ? message : undefined });
    } finally {
      sessionCtx?.cleanup();
    }
  }

  /** Removes yt-dlp's per-stream fragments (e.g. "name.f160.mp4", "name.f140.m4a") left behind when a merge was skipped or failed. */
  private cleanupYtDlpFragments(destinationPath: string): void {
    const dir = path.dirname(destinationPath);
    const base = path.basename(destinationPath, path.extname(destinationPath));
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(`${base}.f`) && /\.f\d+\.\w+$/.test(entry)) {
        try {
          fs.unlinkSync(path.join(dir, entry));
        } catch {
          // best-effort cleanup
        }
      }
    }
  }

  private cleanupPartialFile(destinationPath: string): void {
    for (const candidate of [
      destinationPath,
      `${destinationPath}.part`,
      `${destinationPath}.source`,
      `${destinationPath}.aria2`,
    ]) {
      if (fs.existsSync(candidate)) {
        try {
          fs.unlinkSync(candidate);
        } catch {
          // best-effort cleanup
        }
      }
    }
  }

  pause(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'downloading') return;
    task.status = 'paused';
    task.handle?.cancel();
    this.deps.downloadsRepo.updateProgress(task.downloadId, 'paused', task.progressPercent);
    this.emit(task);
  }

  resume(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') return;
    task.status = 'queued';
    this.queue.push(taskId);
    this.pump();
  }

  cancel(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    if (task.status === 'downloading' || task.status === 'merging') {
      task.handle?.cancel();
    } else {
      task.status = 'cancelled';
      this.deps.downloadsRepo.updateProgress(task.downloadId, 'cancelled', task.progressPercent);
      this.cleanupPartialFile(task.destinationPath);
      this.emit(task);
    }
  }

  retry(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'failed') return;
    task.status = 'queued';
    task.progressPercent = 0;
    this.deps.downloadsRepo.updateProgress(task.downloadId, 'queued', 0);
    this.queue.push(taskId);
    this.pump();
  }

  /** Permanently removes a failed (or otherwise terminal) download from the list — never for one still in progress. */
  dismiss(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && !['completed', 'failed', 'cancelled'].includes(task.status)) return;
    this.tasks.delete(taskId);
    this.deps.downloadsRepo.delete(Number(taskId));
  }

  /** Only downloads worth showing on Descargas: in progress, or failed (actionable). */
  listActive(): DownloadRecord[] {
    return this.deps.downloadsRepo.listActive();
  }
}
