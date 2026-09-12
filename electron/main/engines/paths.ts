import path from 'node:path';
import fs from 'node:fs';

export function binDir(userDataDir: string): string {
  const dir = path.join(userDataDir, 'bin');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function ytDlpBinaryPath(userDataDir: string): string {
  const exe = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  return path.join(binDir(userDataDir), exe);
}

export function ffmpegBinaryPath(userDataDir: string): string {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  return path.join(binDir(userDataDir), exe);
}
