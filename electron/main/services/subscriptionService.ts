import type { SubscriptionsRepo, SubscriptionRecord } from '../database/subscriptionsRepo';
import type { MediaAnalyzer } from '../extraction/mediaAnalyzer';
import type { DownloadManager } from '../downloads/downloadManager';
import type { SettingsService } from './settingsService';
import { getLogger } from '../logging/logger';

function presetToSelector(preset: string): { formatId: string; audioOnly: boolean; extension: string } {
  switch (preset) {
    case 'best':
      return { formatId: 'bestvideo+bestaudio/best', audioOnly: false, extension: 'mp4' };
    case 'best_720p':
      return { formatId: 'bestvideo[height<=720]+bestaudio/best[height<=720]/best', audioOnly: false, extension: 'mp4' };
    case 'audio_only':
      return { formatId: 'bestaudio/best', audioOnly: true, extension: 'm4a' };
    default:
      return { formatId: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best', audioOnly: false, extension: 'mp4' };
  }
}

export class SubscriptionService {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly repo: SubscriptionsRepo,
    private readonly mediaAnalyzer: MediaAnalyzer,
    private readonly downloadManager: DownloadManager,
    private readonly settingsService: SettingsService,
  ) {}

  startAutoCheck(intervalMs = 60 * 60 * 1000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.checkAll();
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async add(url: string, preset = 'best_1080p'): Promise<SubscriptionRecord> {
    const res = await this.mediaAnalyzer.analyzePlaylist(url);
    if (!res.ok) {
      throw new Error(res.error.suggestion ?? res.error.message);
    }
    const seenUrls = res.data.entries.map((e) => e.url);
    return this.repo.insert({
      url,
      title: res.data.title,
      preset,
      seenUrls,
    });
  }

  async checkAll(): Promise<{ checked: number; queued: number }> {
    const logger = getLogger();
    const subs = this.repo.list().filter((s) => s.enabled);
    const settings = this.settingsService.getAll();
    let queued = 0;

    for (const sub of subs) {
      try {
        const res = await this.mediaAnalyzer.analyzePlaylist(sub.url);
        if (!res.ok) continue;

        const seenSet = new Set(sub.seenUrls);
        const newEntries = res.data.entries.filter((e) => !seenSet.has(e.url));
        const { formatId, audioOnly, extension } = presetToSelector(sub.preset);

        for (const entry of newEntries) {
          let source = 'subscription';
          try {
            source = new URL(entry.url).hostname.replace(/^www\./, '');
          } catch {
            // keep fallback
          }
          this.downloadManager.start({
            originalUrl: entry.url,
            title: entry.title,
            source,
            thumbnailUrl: entry.thumbnailUrl,
            durationSeconds: entry.durationSeconds,
            formatId,
            extension,
            filesizeIsEstimate: true,
            filenameTemplate: settings.filenameTemplate,
            useYtDlp: true,
            audioOnly,
            sponsorBlockCategories: settings.sponsorBlockEnabled ? settings.sponsorBlockCategories : undefined,
          });
          seenSet.add(entry.url);
          queued += 1;
        }

        this.repo.updateCheck(sub.id, Array.from(seenSet));
      } catch (err) {
        logger.warn('subscriptionService', 'Failed to check subscription', {
          url: sub.url,
          error: (err as Error).message,
        });
      }
    }

    return { checked: subs.length, queued };
  }
}
