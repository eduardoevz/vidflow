import type { Session } from 'electron';
import blockedDomainsList from './adblockDomains.json';

const BLOCKED_DOMAINS = new Set(blockedDomainsList.map((d) => d.toLowerCase()));

const AD_URL_PATTERNS = [
  /\/pagead\//i,
  /\/adserver\b/i,
  /\/popunder\b/i,
  /\/vast\.xml\b/i,
  /[?&](?:ad_type|ad_url|vast_url|popunder)=/i,
  /\/(?:ads|adx|advert|banners?)\/[^/]*\.(?:js|html|php)/i,
];

export const COSMETIC_ADBLOCK_CSS = `
  .adsbygoogle,
  ins.adsbygoogle,
  [id^="google_ads_iframe"],
  [id*="taboola"],
  [id*="outbrain"],
  [class*="ad-banner"],
  [class*="adBanner"],
  [class*="popunder"],
  iframe[src*="doubleclick.net"],
  iframe[src*="googlesyndication.com"],
  iframe[src*="exoclick.com"],
  iframe[src*="juicyads.com"],
  iframe[src*="trafficjunky.com"],
  iframe[src*="realsrv.com"] {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
`;

export function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_DOMAINS.has(lower)) return true;
  const parts = lower.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (BLOCKED_DOMAINS.has(parent)) return true;
  }
  return false;
}

export function shouldBlockUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (isBlockedHost(parsed.hostname)) return true;
    const pathAndQuery = `${parsed.pathname}${parsed.search}`;
    return AD_URL_PATTERNS.some((pattern) => pattern.test(pathAndQuery));
  } catch {
    return false;
  }
}

export interface AdBlockOptions {
  adBlockEnabled: boolean;
  trackerBlockEnabled: boolean;
  popupBlockEnabled?: boolean;
}

export function installAdBlock(
  session: Session,
  getOptions: () => AdBlockOptions,
  onBlocked?: () => void,
): void {
  session.webRequest.onBeforeRequest((details, callback) => {
    const { adBlockEnabled, trackerBlockEnabled } = getOptions();
    if (!adBlockEnabled && !trackerBlockEnabled) {
      callback({ cancel: false });
      return;
    }
    const blocked = shouldBlockUrl(details.url);
    if (blocked) onBlocked?.();
    callback({ cancel: blocked });
  });
}
