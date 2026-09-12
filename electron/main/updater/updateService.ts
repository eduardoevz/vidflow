/**
 * Thin abstraction around the app's own update mechanism. No release feed is
 * configured yet (this project has no publish infrastructure set up), so
 * `checkForUpdates` currently reports "no update available" rather than
 * failing — see docs/ARCHITECTURE.md and README for how to point this at a
 * real release feed (e.g. GitHub Releases via `electron-updater`) later.
 */
export interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion?: string;
}

export class UpdateService {
  constructor(private readonly currentVersion: string) {}

  checkForUpdates(): Promise<UpdateCheckResult> {
    // Intentionally a no-op until a release feed exists (see docs/ARCHITECTURE.md §Updates).
    return Promise.resolve({ updateAvailable: false, latestVersion: this.currentVersion });
  }
}
