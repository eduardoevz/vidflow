import { create } from 'zustand';
import type { DownloadProgress } from '../../shared/download-types';
import type { DownloadRecord } from '../../shared/download-types';

interface DownloadsState {
  records: DownloadRecord[];
  liveProgress: Record<string, DownloadProgress>;
  refresh: () => Promise<void>;
  subscribe: () => () => void;
}

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  records: [],
  liveProgress: {},
  refresh: async () => {
    const records = await window.vidflow.listDownloads();
    set({ records });
  },
  subscribe: () => {
    return window.vidflow.onDownloadProgress((progress) => {
      set({ liveProgress: { ...get().liveProgress, [progress.taskId]: progress } });
      if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') {
        void get().refresh();
      }
    });
  },
}));
