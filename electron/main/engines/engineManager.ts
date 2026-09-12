import fs from 'node:fs';
import { spawnSafe } from '../security/spawnSafe';
import { ffmpegBinaryPath, ytDlpBinaryPath } from './paths';
import { downloadLatestYtDlp, getLatestYtDlpVersion } from './ytDlpUpdater';
import { downloadLatestFfmpeg } from './ffmpegDownloader';
import { getLogger } from '../logging/logger';
import type { EngineVersions } from '../../../shared/ipc-contract';

function commandExistsOnPath(binary: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawnSafe(binary, args);
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

function runAndCaptureVersion(binary: string, args: string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (!fs.existsSync(binary) && !binary.match(/^[a-zA-Z0-9._-]+$/)) {
      resolve(undefined);
      return;
    }
    try {
      const child = spawnSafe(binary, args);
      let output = '';
      child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString('utf-8')));
      child.on('error', () => resolve(undefined));
      child.on('close', (code) => {
        resolve(code === 0 ? output.trim().split('\n')[0] : undefined);
      });
    } catch {
      resolve(undefined);
    }
  });
}

export class EngineManager {
  constructor(
    private readonly userDataDir: string,
    private readonly appVersion: string,
  ) {}

  private get ytDlpPath(): string {
    return ytDlpBinaryPath(this.userDataDir);
  }

  private get ffmpegPath(): string {
    // Prefer a bundled/managed copy; fall back to a system install on PATH.
    return fs.existsSync(ffmpegBinaryPath(this.userDataDir))
      ? ffmpegBinaryPath(this.userDataDir)
      : 'ffmpeg';
  }

  async getVersions(): Promise<EngineVersions> {
    const [ytDlp, ffmpeg] = await Promise.all([
      runAndCaptureVersion(this.ytDlpPath, ['--version']),
      runAndCaptureVersion(this.ffmpegPath, ['-version']),
    ]);
    return {
      app: this.appVersion,
      ytDlp,
      ffmpeg: ffmpeg?.split(' ')[2],
    };
  }

  async checkForUpdates(): Promise<{ ytDlpUpdateAvailable: boolean }> {
    const versions = await this.getVersions();
    if (!versions.ytDlp) {
      return { ytDlpUpdateAvailable: true };
    }
    try {
      const latest = await getLatestYtDlpVersion();
      return { ytDlpUpdateAvailable: latest.replace(/^v/, '') !== versions.ytDlp };
    } catch (err) {
      getLogger().warn('engineManager', 'Failed to check yt-dlp updates', {
        error: (err as Error).message,
      });
      return { ytDlpUpdateAvailable: false };
    }
  }

  async ensureYtDlp(): Promise<void> {
    if (!fs.existsSync(this.ytDlpPath)) {
      await downloadLatestYtDlp(this.ytDlpPath);
    }
  }

  async updateYtDlp(): Promise<void> {
    await downloadLatestYtDlp(this.ytDlpPath);
  }

  /**
   * Ensures a working FFmpeg is available: does nothing if a managed copy is
   * already installed, or if a system `ffmpeg` is already on PATH — only
   * downloads the managed copy as a last resort, so merging/audio-extraction
   * never silently fails with a missing binary (spec §43).
   */
  async ensureFfmpeg(): Promise<void> {
    const managedPath = ffmpegBinaryPath(this.userDataDir);
    if (fs.existsSync(managedPath)) return;
    if (await commandExistsOnPath('ffmpeg', ['-version'])) return;
    await downloadLatestFfmpeg(managedPath);
  }

  resolvedYtDlpPath(): string {
    return this.ytDlpPath;
  }

  resolvedFfmpegPath(): string {
    return this.ffmpegPath;
  }
}
