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

export function aria2BinaryPath(userDataDir: string): string {
  const exe = process.platform === 'win32' ? 'aria2c.exe' : 'aria2c';
  return path.join(binDir(userDataDir), exe);
}

export function whisperDir(userDataDir: string): string {
  const dir = path.join(binDir(userDataDir), 'whisper');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function whisperBinaryPath(userDataDir: string): string {
  const exe = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
  return path.join(whisperDir(userDataDir), exe);
}

export function whisperModelPath(userDataDir: string): string {
  return path.join(whisperDir(userDataDir), 'ggml-base.bin');
}
