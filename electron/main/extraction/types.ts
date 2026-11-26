import type { MediaInfo } from '../../../shared/media-types';
import type { AnalysisErrorCode } from '../../../shared/media-types';

export class AnalysisFailure extends Error {
  constructor(
    public readonly code: AnalysisErrorCode,
    message: string,
    public readonly suggestion?: string,
  ) {
    super(message);
    this.name = 'AnalysisFailure';
  }
}

export interface ExtractionContext {
  referer?: string;
  userAgent?: string;
  cookiesFilePath?: string;
  getCookieHeader?: (url: string) => Promise<string | undefined>;
}

export interface ExtractionStrategy {
  readonly name: 'yt-dlp' | 'generic' | 'manifest';
  /** Throws AnalysisFailure when this strategy cannot handle the URL. */
  analyze(url: string, context?: ExtractionContext): Promise<MediaInfo>;
}
