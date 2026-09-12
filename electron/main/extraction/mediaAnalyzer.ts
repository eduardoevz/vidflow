import type { MediaInfo, AnalysisError } from '../../../shared/media-types';
import { isHttpUrl } from '../security/paths';
import { AnalysisFailure, type ExtractionStrategy } from './types';
import { getLogger } from '../logging/logger';

export type AnalyzeResult = { ok: true; data: MediaInfo } | { ok: false; error: AnalysisError };

/**
 * Orchestrates the extraction fallback chain: yt-dlp -> generic direct media
 * -> HLS/DASH manifest probe. Never throws; always resolves to a typed result.
 */
export class MediaAnalyzer {
  constructor(private readonly strategies: ExtractionStrategy[]) {}

  async analyze(url: string): Promise<AnalyzeResult> {
    const logger = getLogger();

    if (!isHttpUrl(url)) {
      return { ok: false, error: { code: 'invalid_url', message: 'La URL no es válida.' } };
    }

    let lastFailure: AnalysisFailure | undefined;
    for (const strategy of this.strategies) {
      try {
        const data = await strategy.analyze(url);
        return { ok: true, data };
      } catch (err) {
        if (err instanceof AnalysisFailure) {
          lastFailure = err;
          logger.info('mediaAnalyzer', `${strategy.name} failed`, { code: err.code });
          continue;
        }
        lastFailure = new AnalysisFailure('unknown', (err as Error).message);
      }
    }

    return {
      ok: false,
      error: {
        code: lastFailure?.code ?? 'unknown',
        message: lastFailure?.message ?? 'No fue posible analizar este video.',
        suggestion: lastFailure?.suggestion,
      },
    };
  }
}
