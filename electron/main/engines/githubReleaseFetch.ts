import fs from 'node:fs';
import https from 'node:https';

export interface GithubAsset {
  name: string;
  browser_download_url: string;
}

export interface GithubRelease {
  tag_name: string;
  assets: GithubAsset[];
}

/** Fetches and JSON-parses a GitHub API URL (e.g. a releases/latest endpoint). */
export function httpsGetJson<T>(url: string): Promise<T> {
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

/** Fetches a URL as plain text, following redirects (e.g. a checksum file asset). */
export function httpsGetText(url: string): Promise<string> {
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

/** Downloads a URL to a local file, following redirects (e.g. a release binary/zip asset). */
export function downloadToFile(url: string, destination: string): Promise<void> {
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
