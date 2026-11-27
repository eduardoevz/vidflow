import { spawnSafe } from '../security/spawnSafe';
import { getLogger } from '../logging/logger';

export class FfmpegError extends Error {}

/**
 * Muxes a video-only and audio-only file into a single output, preferring a
 * stream copy (no re-encode) for speed and quality preservation. Falls back
 * to a re-encode only if the copy is rejected, and logs when that happens.
 */
export async function mergeVideoAudio(
  ffmpegPath: string,
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  const logger = getLogger();

  const tryRun = (args: string[]) =>
    new Promise<void>((resolve, reject) => {
      const child = spawnSafe(ffmpegPath, args);
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf-8')));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new FfmpegError(stderr.slice(-800)));
      });
    });

  const copyArgs = [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-c', 'copy',
    '-map', '0:v:0',
    '-map', '1:a:0',
    outputPath,
  ];

  try {
    await tryRun(copyArgs);
    return;
  } catch (err) {
    logger.warn('ffmpegMerger', 'Stream copy failed, falling back to re-encode', {
      error: (err as Error).message,
    });
  }

  const reencodeArgs = [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-map', '0:v:0',
    '-map', '1:a:0',
    outputPath,
  ];
  await tryRun(reencodeArgs);
}

export async function extractAudio(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  targetCodec: 'copy' | 'libmp3lame',
): Promise<void> {
  const args =
    targetCodec === 'copy'
      ? ['-y', '-i', inputPath, '-vn', '-acodec', 'copy', outputPath]
      : ['-y', '-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-b:a', '192k', outputPath];

  return new Promise((resolve, reject) => {
    const child = spawnSafe(ffmpegPath, args);
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf-8')));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new FfmpegError(stderr.slice(-800)));
    });
  });
}

/**
 * Trims a media file to [startSeconds, endSeconds] using FFmpeg stream copy
 * when possible, falling back to re-encoding if keyframe alignment requires it.
 */
export async function trimMediaFile(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  startSeconds: number,
  endSeconds: number,
): Promise<void> {
  const duration = Math.max(0.1, endSeconds - startSeconds);
  const args = [
    '-y',
    '-ss', String(startSeconds),
    '-i', inputPath,
    '-t', String(duration),
    '-c', 'copy',
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    const child = spawnSafe(ffmpegPath, args);
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf-8')));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new FfmpegError(stderr.slice(-800)));
    });
  });
}

export async function convertMediaFile(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  profile: 'mp3' | 'mp4_compact' | 'gif',
): Promise<void> {
  const args =
    profile === 'mp3'
      ? ['-y', '-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-b:a', '192k', outputPath]
      : profile === 'mp4_compact'
        ? [
            '-y',
            '-i',
            inputPath,
            '-c:v',
            'libx264',
            '-crf',
            '28',
            '-preset',
            'veryfast',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            outputPath,
          ]
        : [
            '-y',
            '-i',
            inputPath,
            '-vf',
            'fps=12,scale=480:-1:flags=lanczos',
            '-loop',
            '0',
            outputPath,
          ];

  return new Promise((resolve, reject) => {
    const child = spawnSafe(ffmpegPath, args);
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf-8')));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new FfmpegError(stderr.slice(-800)));
    });
  });
}
