import type { Session } from 'electron';
import type { DetectedBrowserMedia } from '../../../shared/ipc-contract';
import { isHttpUrl } from '../security/paths';

const SEGMENT_EXTENSIONS = ['.ts', '.m4s', '.m4f', '.aac', '.vtt', '.srt', '.key'];
const DIRECT_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.m4v', '.mov'];

export interface ClassifiedMedia {
  type: DetectedBrowserMedia['type'];
  mimeType?: string;
  sizeBytes?: number;
}

function getHeaderCaseInsensitive(
  headers: Record<string, string[]> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [key, values] of Object.entries(headers)) {
    if (key.toLowerCase() === target && values.length > 0) {
      return values[0];
    }
  }
  return undefined;
}

export function classifyMediaResponse(
  url: string,
  statusCode: number,
  responseHeaders?: Record<string, string[]>,
): ClassifiedMedia | null {
  if (!isHttpUrl(url) || statusCode >= 400) return null;

  let pathname = '';
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }

  if (SEGMENT_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    return null;
  }

  const rawContentType = getHeaderCaseInsensitive(responseHeaders, 'content-type');
  const mimeType = rawContentType?.split(';')[0]?.trim().toLowerCase();

  // Ignore MPEG-TS segments even when served without a .ts extension.
  if (mimeType === 'video/mp2t') {
    return null;
  }

  const rawLength = getHeaderCaseInsensitive(responseHeaders, 'content-length');
  const parsedLength = rawLength ? Number(rawLength) : undefined;
  const sizeBytes = parsedLength && Number.isFinite(parsedLength) && parsedLength > 0 ? parsedLength : undefined;

  if (
    pathname.endsWith('.m3u8') ||
    mimeType === 'application/vnd.apple.mpegurl' ||
    mimeType === 'application/x-mpegurl'
  ) {
    return { type: 'hls', mimeType, sizeBytes };
  }

  if (pathname.endsWith('.mpd') || mimeType === 'application/dash+xml') {
    return { type: 'dash', mimeType, sizeBytes };
  }

  if (
    DIRECT_VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext)) ||
    (mimeType !== undefined && mimeType.startsWith('video/'))
  ) {
    return { type: 'video', mimeType, sizeBytes };
  }

  return null;
}

export class MediaSniffer {
  private readonly items = new Map<string, DetectedBrowserMedia>();

  constructor(private readonly onChanged: (items: DetectedBrowserMedia[]) => void) {}

  list(): DetectedBrowserMedia[] {
    return Array.from(this.items.values()).sort((a, b) => b.detectedAt - a.detectedAt);
  }

  clear(): void {
    if (this.items.size === 0) return;
    this.items.clear();
    this.onChanged([]);
  }

  record(
    url: string,
    statusCode: number,
    responseHeaders: Record<string, string[]> | undefined,
    context: { referer?: string; pageTitle?: string },
  ): void {
    const classified = classifyMediaResponse(url, statusCode, responseHeaders);
    if (!classified) return;

    const existing = this.items.get(url);
    const entry: DetectedBrowserMedia = {
      url,
      type: classified.type,
      mimeType: classified.mimeType ?? existing?.mimeType,
      sizeBytes: classified.sizeBytes ?? existing?.sizeBytes,
      referer: context.referer || existing?.referer,
      pageTitle: context.pageTitle || existing?.pageTitle,
      detectedAt: existing?.detectedAt ?? Date.now(),
    };
    this.items.set(url, entry);
    this.onChanged(this.list());
  }

  installOnSession(
    ses: Session,
    getPageContext: () => { pageUrl: string; pageTitle: string },
  ): void {
    ses.webRequest.onHeadersReceived((details, callback) => {
      try {
        const { pageUrl, pageTitle } = getPageContext();
        this.record(details.url, details.statusCode, details.responseHeaders, {
          referer: details.referrer || pageUrl || undefined,
          pageTitle: pageTitle || undefined,
        });
      } catch {
        // Never block or break page requests if sniffing fails.
      }
      callback({});
    });
  }
}
