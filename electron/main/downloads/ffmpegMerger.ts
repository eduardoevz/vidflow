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
