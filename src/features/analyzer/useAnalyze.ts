import { useCallback, useState } from 'react';
import type { AnalysisError, MediaInfo } from '../../../shared/media-types';

interface AnalyzeState {
  loading: boolean;
  media?: MediaInfo;
  error?: AnalysisError;
  analyze: (url: string) => Promise<void>;
  reset: () => void;
}

export function useAnalyze(): AnalyzeState {
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<MediaInfo | undefined>(undefined);
  const [error, setError] = useState<AnalysisError | undefined>(undefined);

  const analyze = useCallback(async (url: string) => {
    setLoading(true);
    setError(undefined);
    setMedia(undefined);
    try {
      const result = await window.vidflow.analyzeUrl(url);
      if (result.ok) {
        setMedia(result.data);
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setMedia(undefined);
    setError(undefined);
  }, []);

  return { loading, media, error, analyze, reset };
}
