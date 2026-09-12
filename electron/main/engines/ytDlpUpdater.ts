import fs from 'node:fs';
import crypto from 'node:crypto';
import https from 'node:https';
import { getLogger } from '../logging/logger';

const YTDLP_RELEASE_API = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';
const YTDLP_WINDOWS_ASSET = 'yt-dlp.exe';
const YTDLP_CHECKSUM_ASSET = 'SHA2-256SUMS';

interface GithubAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
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

function httpsGetText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'VidFlow' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpsGetText(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let body = '';
        res.on('data', (chunk: Buffer) => (body += chunk.toString('utf-8')));
        res.on('end', () => resolve(body));
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

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Downloads the latest yt-dlp Windows binary from the official GitHub
 * releases API and verifies it against the checksums yt-dlp publishes for
 * that release before installing it at `destinationPath`.
 */
export async function downloadLatestYtDlp(destinationPath: string): Promise<string> {
  const logger = getLogger();
  const release = await httpsGetJson<GithubRelease>(YTDLP_RELEASE_API);
  const exeAsset = release.assets.find((a) => a.name === YTDLP_WINDOWS_ASSET);
  const checksumAsset = release.assets.find((a) => a.name === YTDLP_CHECKSUM_ASSET);

  if (!exeAsset) {
    throw new Error('yt-dlp release did not contain a Windows binary asset');
  }

  const tempPath = `${destinationPath}.download`;
  await downloadToFile(exeAsset.browser_download_url, tempPath);

  if (checksumAsset) {
    const checksumText = await httpsGetText(checksumAsset.browser_download_url);
    const expectedLine = checksumText
      .split('\n')
      .find((line) => line.trim().endsWith(YTDLP_WINDOWS_ASSET));
    const expectedHash = expectedLine?.split(/\s+/)[0];
    if (expectedHash) {
      const actualHash = await sha256File(tempPath);
      if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
        fs.unlinkSync(tempPath);
        throw new Error('yt-dlp checksum verification failed — download aborted');
      }
    } else {
      logger.warn('ytDlpUpdater', 'Could not find expected checksum line; skipping verification');
    }
  } else {
    logger.warn('ytDlpUpdater', 'Release had no checksum asset; skipping verification');
  }

  fs.renameSync(tempPath, destinationPath);
  logger.info('ytDlpUpdater', `Installed yt-dlp ${release.tag_name}`);
  return release.tag_name;
}

export async function getLatestYtDlpVersion(): Promise<string> {
  const release = await httpsGetJson<GithubRelease>(YTDLP_RELEASE_API);
  return release.tag_name;
}
