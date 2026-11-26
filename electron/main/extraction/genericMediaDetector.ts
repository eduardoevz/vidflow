import https from 'node:https';
import http from 'node:http';
import type { MediaInfo, MediaFormat } from '../../../shared/media-types';
import { AnalysisFailure, type ExtractionContext, type ExtractionStrategy } from './types';

const DIRECT_MEDIA_EXTENSIONS = ['.mp4', '.webm', '.m4v', '.mov'];

function headRequest(
  url: string,
  headers: Record<string, string>,
): Promise<{ contentType?: string; contentLength?: number }> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, { method: 'HEAD', headers }, (res) => {
      resolve({
        contentType: res.headers['content-type'],
        contentLength: res.headers['content-length'] ? Number(res.headers['content-length']) : undefined,
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Fallback strategy for a URL that points directly at a media file
 * (.mp4/.webm/.m4v) rather than a page yt-dlp knows how to parse.
 */
export class GenericMediaDetector implements ExtractionStrategy {
  readonly name = 'generic' as const;

  async analyze(url: string, context?: ExtractionContext): Promise<MediaInfo> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new AnalysisFailure('invalid_url', 'La URL no es válida.');
    }

    const hasDirectExtension = DIRECT_MEDIA_EXTENSIONS.some((ext) =>
      parsed.pathname.toLowerCase().endsWith(ext),
    );
    if (!hasDirectExtension) {
      throw new AnalysisFailure('unsupported_site', 'No se detectó un archivo multimedia directo.');
    }

    let head: { contentType?: string; contentLength?: number };
    try {
      const headers: Record<string, string> = { 'User-Agent': context?.userAgent ?? 'VidFlow' };
      if (context?.referer) headers.Referer = context.referer;
      const cookie = await context?.getCookieHeader?.(url);
      if (cookie) headers.Cookie = cookie;
      head = await headRequest(url, headers);
    } catch (err) {
      throw new AnalysisFailure('network_error', `No se pudo acceder al recurso: ${(err as Error).message}`);
    }

    if (head.contentType && !head.contentType.startsWith('video') && !head.contentType.startsWith('audio')) {
      throw new AnalysisFailure('unsupported_site', 'El recurso no parece ser multimedia.');
    }

    const extension = parsed.pathname.split('.').pop() ?? 'mp4';
    const format: MediaFormat = {
      kind: 'video',
      formatId: 'direct',
      extension,
      protocol: 'direct',
      url,
      filesizeBytes: head.contentLength,
      filesizeIsEstimate: false,
      audioOnly: false,
      videoOnly: false,
      hasAudio: true,
      hasVideo: true,
    };

    const fileName = parsed.pathname.split('/').pop() ?? 'video';

    return {
      metadata: {
        title: decodeURIComponent(fileName),
        siteName: parsed.hostname,
        originalUrl: url,
      },
      formats: [format],
      subtitles: [],
      isLive: false,
      extractor: 'generic',
    };
  }
}
