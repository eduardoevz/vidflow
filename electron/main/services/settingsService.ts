import path from 'node:path';
import { app } from 'electron';
import type { SettingsRepo } from '../database/settingsRepo';
import type { AppSettings } from '../../../shared/settings-types';

export class SettingsService {
  constructor(private readonly repo: SettingsRepo) {}

  private defaultDownloadsDirectory(): string {
    return path.join(app.getPath('videos'), 'VideoDownloader');
  }

  getAll(): AppSettings {
    const settings = this.repo.getAll();
    if (!settings.downloadsDirectory) {
      settings.downloadsDirectory = this.defaultDownloadsDirectory();
    }
    return settings;
  }

  update(patch: Partial<AppSettings>): AppSettings {
    return this.repo.update(patch);
  }
}
