import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import AdmZip from 'adm-zip';
import { getLogger } from '../logging/logger';

const FFMPEG_RELEASE_API = 'https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest';
const FFMPEG_ASSET_NAME = 'ffmpeg-master-latest-win64-gpl.zip';

interface GithubAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  assets: GithubAsset[];
}

function httpsGetJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'VidFlow' } }, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`GET ${url} failed with status ${res.statusCode}`));
          return;
        }
        let body = '';
        res.on('data', (chunk: Buffer) => (body += chunk.toString('utf-8')));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body) as T);
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      })
      .on('error', reject);
  });
}

function downloadToFile(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    https
      .get(url, { headers: { 'User-Agent': 'VidFlow' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadToFile(res.headers.location, destination).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', reject);
  });
}

/**
 * Downloads a static FFmpeg build for Windows from BtbN/FFmpeg-Builds — one
 * of the prebuilt-binary sources ffmpeg.org's own Windows download page
 * links to — and extracts just bin/ffmpeg.exe to `destinationPath`.
 */
export async function downloadLatestFfmpeg(destinationPath: string): Promise<void> {
  const logger = getLogger();
  const release = await httpsGetJson<GithubRelease>(FFMPEG_RELEASE_API);
  const asset = release.assets.find((a) => a.name === FFMPEG_ASSET_NAME);
  if (!asset) {
    throw new Error('No se encontró el paquete de FFmpeg para Windows en la última versión publicada.');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vidflow-ffmpeg-'));
  const zipPath = path.join(tempDir, 'ffmpeg.zip');
  try {
    logger.info('ffmpegDownloader', 'Downloading FFmpeg build', { asset: asset.name });
    await downloadToFile(asset.browser_download_url, zipPath);

    const zip = new AdmZip(zipPath);
    const entry = zip
      .getEntries()
      .find((e) => e.entryName.toLowerCase().endsWith('/bin/ffmpeg.exe') || e.entryName.toLowerCase() === 'bin/ffmpeg.exe');
    if (!entry) {
      throw new Error('El paquete de FFmpeg descargado no contiene bin/ffmpeg.exe.');
    }

    const tempExePath = `${destinationPath}.download`;
    fs.writeFileSync(tempExePath, entry.getData());
    fs.renameSync(tempExePath, destinationPath);
    logger.info('ffmpegDownloader', 'Installed FFmpeg', { destinationPath });
  } finally {
    // Best-effort cleanup only — a lingering AV scan or file handle on the
    // ~190MB zip can make this throw ENOTEMPTY right after extraction, which
    // must never mask a successful install as a failure.
    try {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
    } catch (err) {
      logger.warn('ffmpegDownloader', 'Failed to clean up temp directory', {
        tempDir,
        error: (err as Error).message,
      });
    }
  }
}
