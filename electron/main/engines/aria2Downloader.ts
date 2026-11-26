import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import AdmZip from 'adm-zip';
import { getLogger } from '../logging/logger';
import { httpsGetJson, downloadToFile, type GithubRelease } from './githubReleaseFetch';

const ARIA2_RELEASE_API = 'https://api.github.com/repos/aria2/aria2/releases/latest';
const ARIA2_ASSET_PATTERN = /^aria2-.*-win-64bit-build\d+\.zip$/i;

/**
 * Downloads the official static Windows build of aria2 from its GitHub
 * releases and extracts just aria2c.exe to `destinationPath`. aria2 does not
 * publish a checksum file for its release assets, so (like FFmpeg's
 * downloader) this proceeds without verification.
 */
export async function downloadLatestAria2(destinationPath: string): Promise<void> {
  const logger = getLogger();
  const release = await httpsGetJson<GithubRelease>(ARIA2_RELEASE_API);
  const asset = release.assets.find((a) => ARIA2_ASSET_PATTERN.test(a.name));
  if (!asset) {
    throw new Error('No se encontró el paquete de aria2 para Windows en la última versión publicada.');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vidflow-aria2-'));
  const zipPath = path.join(tempDir, 'aria2.zip');
  try {
    logger.info('aria2Downloader', 'Downloading aria2 build', { asset: asset.name });
    await downloadToFile(asset.browser_download_url, zipPath);

    const zip = new AdmZip(zipPath);
    const entry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith('aria2c.exe'));
    if (!entry) {
      throw new Error('El paquete de aria2 descargado no contiene aria2c.exe.');
    }

    const tempExePath = `${destinationPath}.download`;
    fs.writeFileSync(tempExePath, entry.getData());
    fs.renameSync(tempExePath, destinationPath);
    logger.info('aria2Downloader', 'Installed aria2', { destinationPath });
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
    } catch (err) {
      logger.warn('aria2Downloader', 'Failed to clean up temp directory', {
        tempDir,
        error: (err as Error).message,
      });
    }
  }
}
