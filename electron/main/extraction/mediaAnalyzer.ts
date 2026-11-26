import type { MediaInfo, AnalysisError, AnalysisOptions } from '../../../shared/media-types';
import { isHttpUrl } from '../security/paths';
import { AnalysisFailure, type ExtractionContext, type ExtractionStrategy } from './types';
import { getLogger } from '../logging/logger';

export type AnalyzeResult = { ok: true; data: MediaInfo } | { ok: false; error: AnalysisError };

export type ExtractionContextProvider = () => Promise<{
  context: ExtractionContext;
  cleanup: () => void;
}>;

/**
 * Orchestrates the extraction fallback chain: yt-dlp -> generic direct media
 * -> HLS/DASH manifest probe. Never throws; always resolves to a typed result.
 */
export class MediaAnalyzer {
  constructor(
    private readonly strategies: ExtractionStrategy[],
    private readonly contextProvider?: ExtractionContextProvider,
  ) {}

  async analyze(url: string, options?: AnalysisOptions): Promise<AnalyzeResult> {
    const logger = getLogger();

    if (!isHttpUrl(url)) {
      return { ok: false, error: { code: 'invalid_url', message: 'La URL no es válida.' } };
    }

    let provided: { context: ExtractionContext; cleanup: () => void } | undefined;
    try {
      provided = this.contextProvider ? await this.contextProvider() : undefined;
    } catch (err) {
      logger.warn('mediaAnalyzer', 'Failed to prepare extraction context', {
        error: (err as Error).message,
      });
    }

    const context: ExtractionContext = {
      ...provided?.context,
      referer: options?.referer ?? provided?.context.referer,
    };

    try {
      let lastFailure: AnalysisFailure | undefined;
      for (const strategy of this.strategies) {
        try {
          const data = await strategy.analyze(url, context);
          if (context.referer && !data.metadata.referer) {
            data.metadata.referer = context.referer;
          }
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
    } finally {
      provided?.cleanup();
    }
  }
}
