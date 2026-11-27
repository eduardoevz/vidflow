import type { PlaylistEntry, PlaylistInfo } from '../../../shared/media-types';
import { AnalysisFailure, type ExtractionContext } from './types';

const DIRECT_MEDIA_RE = /\.(mp4|webm|m4v|mov|m3u8|mpd)(\?|$)/i;
const VIDEO_LINK_RE = /\/(video[-_/]|videos\/|watch\b|v\/|clip\/|episode\/|embed\/|media\/|hd-porn\/)/i;

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromSlug(url: URL): string {
  const segments = url.pathname.split('/').filter(Boolean);
  const candidate = [...segments].reverse().find((s) => !/^video-[a-z0-9]+$/i.test(s) && s.length > 3);
  if (!candidate) return url.pathname;
  return decodeURIComponent(candidate).replace(/[-_]+/g, ' ').trim();
}

export function extractPlaylistFromHtml(html: string, pageUrl: string): PlaylistInfo {
  const base = new URL(pageUrl);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch ? decodeHtmlEntities(titleMatch[1] ?? '') : base.hostname;

  const entries: PlaylistEntry[] = [];
  const seen = new Set<string>();

  const anchorRe = /<a\b([^>]*?)href=["']([^"'#]+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) !== null) {
    const attrs = `${match[1] ?? ''} ${match[3] ?? ''}`;
    const rawHref = match[2]?.trim();
    const innerHtml = match[4] ?? '';
    if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) continue;

    let resolved: URL;
    try {
      resolved = new URL(rawHref, base);
    } catch {
      continue;
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
    resolved.hash = '';
    const canonical = resolved.toString();
    if (canonical === pageUrl || seen.has(canonical)) continue;

    const isDirect = DIRECT_MEDIA_RE.test(resolved.pathname);
    const isSameOriginVideo =
      resolved.hostname === base.hostname && VIDEO_LINK_RE.test(`${resolved.pathname}${resolved.search}`);

    if (!isDirect && !isSameOriginVideo) continue;

    seen.add(canonical);

    const attrTitle = attrs.match(/(?:title|aria-label)=["']([^"']+)["']/i)?.[1];
    const textTitle = innerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const rawTitle = attrTitle || textTitle || titleFromSlug(resolved);
    const title = decodeHtmlEntities(rawTitle) || canonical;

    entries.push({
      id: canonical,
      title,
      url: canonical,
    });
  }

  // Also scan direct <video> / <source> tags if no anchor links were found
  if (entries.length === 0) {
    const mediaTagRe = /<(?:video|source)\b[^>]*src=["']([^"']+)["']/gi;
    while ((match = mediaTagRe.exec(html)) !== null) {
      const rawSrc = match[1]?.trim();
      if (!rawSrc) continue;
      try {
        const resolved = new URL(rawSrc, base);
        resolved.hash = '';
        const canonical = resolved.toString();
        if (!seen.has(canonical)) {
          seen.add(canonical);
          entries.push({
            id: canonical,
            title: titleFromSlug(resolved),
            url: canonical,
          });
        }
      } catch {
        // ignore invalid src
      }
    }
  }

  return {
    title: pageTitle || 'Videos encontrados en la página',
    originalUrl: pageUrl,
    entries,
  };
}

export class GenericPlaylistExtractor {
  async analyzePlaylist(url: string, context?: ExtractionContext): Promise<PlaylistInfo> {
    const headers: Record<string, string> = {
      'User-Agent':
        context?.userAgent ??
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    };
    if (context?.referer) headers.Referer = context.referer;
    const cookie = await context?.getCookieHeader?.(url);
    if (cookie) headers.Cookie = cookie;

    let res: Response;
    try {
      res = await fetch(url, { headers, redirect: 'follow' });
    } catch (err) {
      throw new AnalysisFailure('network_error', `No se pudo acceder a la página: ${(err as Error).message}`);
    }

    if (!res.ok) {
      throw new AnalysisFailure(
        res.status === 401 || res.status === 403 ? 'auth_required' : 'network_error',
        `El sitio respondió con estado HTTP ${res.status}.`,
      );
    }

    const html = await res.text();
    const playlist = extractPlaylistFromHtml(html, res.url || url);
    if (playlist.entries.length === 0) {
      throw new AnalysisFailure(
        'unsupported_site',
        'No se encontraron enlaces de video en esta página o playlist.',
      );
    }
    return playlist;
  }
}
