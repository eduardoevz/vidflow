import fs from 'node:fs';
import { shell } from 'electron';
import type { HistoryRepo } from '../database/historyRepo';
import type { MediaItemsRepo } from '../database/mediaItemsRepo';
import { getLogger } from '../logging/logger';

export class HistoryFileService {
  constructor(
    private readonly historyRepo: HistoryRepo,
    private readonly mediaItemsRepo: MediaItemsRepo,
  ) {}

  /** Removes only the history row (and orphaned media_item) — file on disk is untouched. */
  removeFromHistory(id: number): void {
    const record = this.historyRepo.findById(id);
    if (!record) return;
    this.historyRepo.delete(id);
    this.mediaItemsRepo.deleteIfOrphaned(record.mediaItemId);
  }

  /** Explicit, separate action: deletes the actual file from disk (via the OS trash), then the row. */
  async deleteFile(id: number): Promise<void> {
    const record = this.historyRepo.findById(id);
    if (!record) return;
    try {
      if (fs.existsSync(record.localPath)) {
        await shell.trashItem(record.localPath);
      }
    } catch (err) {
      getLogger().warn('historyFileService', 'Failed to trash file', { error: (err as Error).message });
    }
    this.historyRepo.delete(id);
    this.mediaItemsRepo.deleteIfOrphaned(record.mediaItemId);
  }

  clearAll(): void {
    this.historyRepo.clear();
  }
}
