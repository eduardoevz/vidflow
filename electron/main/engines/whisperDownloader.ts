import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { httpsGetJson, type GithubRelease } from './githubReleaseFetch';
import { whisperBinaryPath, whisperDir, whisperModelPath } from './paths';

const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';

async function downloadFile(url: string, destination: string): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Error al descargar (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, buffer);
}

export async function ensureWhisperInstalled(userDataDir: string): Promise<{
  binaryPath: string;
  modelPath: string;
}> {
  const binPath = whisperBinaryPath(userDataDir);
  const modPath = whisperModelPath(userDataDir);
  const dir = whisperDir(userDataDir);

  if (!fs.existsSync(binPath)) {
    const release = await httpsGetJson<GithubRelease>(
      'https://api.github.com/repos/ggerganov/whisper.cpp/releases/latest',
    );
    const asset = release.assets.find((a) => /whisper-bin-x64\.zip$/i.test(a.name));
    if (!asset) {
      throw new Error('No se encontró el binario de whisper.cpp para Windows x64.');
    }
    const zipPath = path.join(dir, 'whisper-bin.zip');
    await downloadFile(asset.browser_download_url, zipPath);
    const zip = new AdmZip(zipPath);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const base = path.basename(entry.entryName);
      if (/\.(exe|dll)$/i.test(base)) {
        fs.writeFileSync(path.join(dir, base), entry.getData());
      }
    }
    fs.unlinkSync(zipPath);
    if (!fs.existsSync(binPath)) {
      // Older releases named the binary main.exe
      const legacyMain = path.join(dir, 'main.exe');
      if (fs.existsSync(legacyMain)) {
        fs.renameSync(legacyMain, binPath);
      } else {
        throw new Error('whisper-cli.exe no se encontró dentro del paquete.');
      }
    }
  }

  if (!fs.existsSync(modPath)) {
    await downloadFile(MODEL_URL, modPath);
  }

  return { binaryPath: binPath, modelPath: modPath };
}
