import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSafe } from '../security/spawnSafe';

function runProcess(binary: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnSafe(binary, args);
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf-8')));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-800) || `${path.basename(binary)} exited with code ${code}`));
    });
  });
}

export async function transcribeToSrt(
  ffmpegPath: string,
  whisperBinPath: string,
  modelPath: string,
  inputMediaPath: string,
  outputSrtPath: string,
): Promise<string> {
  const tempWav = path.join(os.tmpdir(), `vidflow-whisper-${Date.now()}.wav`);
  const outPrefix = outputSrtPath.replace(/\.srt$/i, '');

  try {
    await runProcess(ffmpegPath, [
      '-y',
      '-i',
      inputMediaPath,
      '-vn',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      tempWav,
    ]);

    await runProcess(whisperBinPath, [
      '-m',
      modelPath,
      '-f',
      tempWav,
      '-l',
      'auto',
      '-osrt',
      '-of',
      outPrefix,
    ]);

    return `${outPrefix}.srt`;
  } finally {
    if (fs.existsSync(tempWav)) {
      try {
        fs.unlinkSync(tempWav);
      } catch {
        // ignore cleanup error
      }
    }
  }
}
