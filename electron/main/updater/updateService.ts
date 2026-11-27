export interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion?: string;
  releaseUrl?: string;
}

export function parseReleaseNumber(tag: string): number {
  const match = tag.trim().match(/^v?(\d+)$/i);
  return match?.[1] ? Number(match[1]) : 0;
}

export class UpdateService {
  constructor(
    private readonly currentTag: string,
    private readonly repoSlug = 'eduardoevz/vidflow',
  ) {}

  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      const res = await fetch(`https://api.github.com/repos/${this.repoSlug}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'VidFlow-Updater',
        },
      });
      if (!res.ok) {
        return { updateAvailable: false, latestVersion: this.currentTag };
      }
      const data = (await res.json()) as { tag_name?: string; html_url?: string };
      const latestTag = data.tag_name ?? this.currentTag;
      const updateAvailable = parseReleaseNumber(latestTag) > parseReleaseNumber(this.currentTag);
      return {
        updateAvailable,
        latestVersion: latestTag,
        releaseUrl: data.html_url,
      };
    } catch {
      return { updateAvailable: false, latestVersion: this.currentTag };
    }
  }
}
