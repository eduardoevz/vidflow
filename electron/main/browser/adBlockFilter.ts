import type { Session } from 'electron';
// resolveJsonModule inlines this array directly into the compiled output, so
// no separate asset file needs to ship (or be found) alongside the built JS.
import blockedDomains from './adblockDomains.json';

function hostMatches(hostname: string, blockedDomains: string[]): boolean {
  return blockedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export interface AdBlockOptions {
  adBlockEnabled: boolean;
  trackerBlockEnabled: boolean;
}

/**
 * Installs a webRequest.onBeforeRequest filter on the given session that
 * blocks requests to known ad/tracker domains before they are sent.
 * Both flags share the same vendored domain list for the MVP; they are
 * exposed as separate settings so a future release can use distinct lists.
 */
export function installAdBlock(session: Session, getOptions: () => AdBlockOptions): void {
  session.webRequest.onBeforeRequest((details, callback) => {
    const { adBlockEnabled, trackerBlockEnabled } = getOptions();
    if (!adBlockEnabled && !trackerBlockEnabled) {
      callback({ cancel: false });
      return;
    }
    try {
      const hostname = new URL(details.url).hostname;
      const blocked = hostMatches(hostname, blockedDomains);
      callback({ cancel: blocked });
    } catch {
      callback({ cancel: false });
    }
  });
}
