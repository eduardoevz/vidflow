import https from 'node:https';
import http from 'node:http';
import type { MediaInfo, MediaFormat } from '../../../shared/media-types';
import { AnalysisFailure, type ExtractionStrategy } from './types';

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client
      .get(url, { headers: { 'User-Agent': 'VidFlow' } }, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let body = '';
        res.on('data', (chunk: Buffer) => (body += chunk.toString('utf-8')));
        res.on('end', () => resolve(body));
      })
      .on('error', reject);
  });
}

function parseHlsVariants(playlist: string, baseUrl: string): MediaFormat[] {
  const lines = playlist.split('\n');
  const formats: MediaFormat[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line?.startsWith('#EXT-X-STREAM-INF:')) continue;
    const nextLine = lines[i + 1]?.trim();
    if (!nextLine || nextLine.startsWith('#')) continue;

    const resolutionMatch = /RESOLUTION=(\d+)x(\d+)/.exec(line);
    const bandwidthMatch = /BANDWIDTH=(\d+)/.exec(line);
    const streamUrl = new URL(nextLine, baseUrl).toString();
    const height = resolutionMatch ? Number(resolutionMatch[2]) : undefined;

    formats.push({
      kind: 'video',
      formatId: `hls-${formats.length}`,
      extension: 'mp4',
      protocol: 'hls',
      url: streamUrl,
      width: resolutionMatch ? Number(resolutionMatch[1]) : undefined,
      height,
      resolutionLabel: height ? `${height}p` : undefined,
      bitrateKbps: bandwidthMatch ? Math.round(Number(bandwidthMatch[1]) / 1000) : undefined,
      filesizeIsEstimate: true,
      audioOnly: false,
      videoOnly: false,
      hasAudio: true,
      hasVideo: true,
    });
  }
  return formats;
}

/** Probes .m3u8 (HLS) / .mpd (DASH) manifests directly when yt-dlp cannot. */
export class ManifestProbe implements ExtractionStrategy {
  readonly name = 'manifest' as const;

  async analyze(url: string): Promise<MediaInfo> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new AnalysisFailure('invalid_url', 'La URL no es válida.');
    }

    const isHls = parsed.pathname.toLowerCase().endsWith('.m3u8');
    const isDash = parsed.pathname.toLowerCase().endsWith('.mpd');
    if (!isHls && !isDash) {
      throw new AnalysisFailure('unsupported_site', 'No se detectó un manifiesto HLS/DASH.');
    }

    let body: string;
    try {
      body = await fetchText(url);
    } catch (err) {
      throw new AnalysisFailure('network_error', `No se pudo acceder al manifiesto: ${(err as Error).message}`);
    }

    if (isDash) {
      // DASH manifests are XML; a full parser is out of scope for the MVP —
      // report a single format pointing at the manifest itself so the user
      // is not blocked, but flag the size as unknown/estimated.
      const format: MediaFormat = {
        kind: 'video',
        formatId: 'dash-0',
        extension: 'mp4',
        protocol: 'dash',
        url,
        filesizeIsEstimate: true,
        audioOnly: false,
        videoOnly: false,
        hasAudio: true,
        hasVideo: true,
      };
      return {
        metadata: { title: parsed.pathname.split('/').pop() ?? 'video', siteName: parsed.hostname, originalUrl: url },
        formats: [format],
        subtitles: [],
        isLive: false,
        extractor: 'manifest',
      };
    }

    const formats = parseHlsVariants(body, url);
    if (formats.length === 0) {
      throw new AnalysisFailure('unsupported_site', 'El manifiesto HLS no contiene variantes reproducibles.');
    }

    return {
      metadata: {
        title: parsed.pathname.split('/').pop() ?? 'video',
        siteName: parsed.hostname,
        originalUrl: url,
      },
      formats,
      subtitles: [],
      isLive: body.includes('#EXT-X-PLAYLIST-TYPE:EVENT') || !body.includes('#EXT-X-ENDLIST'),
      extractor: 'manifest',
    };
  }
}
