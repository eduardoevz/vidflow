import { spawnSafe } from '../security/spawnSafe';
import { normalizeMediaInfo } from './normalizeMediaInfo';
import { AnalysisFailure, type ExtractionContext, type ExtractionStrategy } from './types';
import type { YtDlpInfoJson } from './ytDlpJson';
import type { MediaInfo } from '../../../shared/media-types';
import { getLogger } from '../logging/logger';

const KNOWN_ERROR_PATTERNS: { pattern: RegExp; code: AnalysisFailure['code']; suggestion: string }[] = [
  {
    pattern: /private video|this video is private/i,
    code: 'private_video',
    suggestion: 'Este contenido es privado y no puede analizarse.',
  },
  {
    pattern: /sign in|login required|age.?restricted/i,
    code: 'auth_required',
    suggestion: 'Este sitio requiere autenticación.',
  },
  {
    pattern: /drm|widevine|playready/i,
    code: 'protected_content',
    suggestion: 'Contenido protegido o no compatible.',
  },
  {
    pattern: /unsupported url|no extractor/i,
    code: 'unsupported_site',
    suggestion: 'Este sitio no es compatible actualmente.',
  },
];

function classifyStderr(stderr: string): AnalysisFailure {
  for (const { pattern, code, suggestion } of KNOWN_ERROR_PATTERNS) {
    if (pattern.test(stderr)) {
      return new AnalysisFailure(code, stderr.trim().slice(0, 500), suggestion);
    }
  }
  return new AnalysisFailure(
    'extractor_outdated',
    stderr.trim().slice(0, 500) || 'yt-dlp no pudo analizar la URL.',
    'El sitio pudo haber cambiado recientemente. Prueba a actualizar el motor.',
  );
}

export class YtDlpAdapter implements ExtractionStrategy {
  readonly name = 'yt-dlp' as const;

  constructor(private readonly binaryPath: string) {}

  async analyze(url: string, context?: ExtractionContext): Promise<MediaInfo> {
    const logger = getLogger();
    const args = ['--dump-json', '--no-playlist', '--no-warnings', '--skip-download'];
    if (context?.cookiesFilePath) args.push('--cookies', context.cookiesFilePath);
    if (context?.userAgent) args.push('--user-agent', context.userAgent);
    if (context?.referer) args.push('--referer', context.referer);
    args.push(url);

    return new Promise<MediaInfo>((resolve, reject) => {
      const child = spawnSafe(this.binaryPath, args);

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf-8')));
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf-8')));

      child.on('error', (err) => {
        reject(new AnalysisFailure('unknown', `No se pudo ejecutar yt-dlp: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          logger.warn('ytDlpAdapter', 'yt-dlp exited with error', { code, stderr: stderr.slice(0, 300) });
          reject(classifyStderr(stderr));
          return;
        }
        try {
          const firstLine = stdout.trim().split('\n')[0];
          if (!firstLine) {
            reject(new AnalysisFailure('unknown', 'yt-dlp no devolvió información.'));
            return;
          }
          const parsed = JSON.parse(firstLine) as YtDlpInfoJson;
          const media = normalizeMediaInfo(parsed);
          if (!media.metadata.originalUrl) {
            media.metadata.originalUrl = url;
          }
          if (media.formats.length === 0) {
            reject(
              new AnalysisFailure(
                'unsupported_site',
                'No se encontraron formatos descargables en esta URL.',
              ),
            );
            return;
          }
          resolve(media);
        } catch (err) {
          reject(new AnalysisFailure('unknown', `Respuesta de yt-dlp no válida: ${(err as Error).message}`));
        }
      });
    });
  }
}
