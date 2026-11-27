import fs from 'node:fs';
import path from 'node:path';
import type { Session } from 'electron';
import blockedDomainsList from './adblockDomains.json';

const STATIC_DOMAINS = new Set(blockedDomainsList.map((d) => d.toLowerCase()));
const DYNAMIC_DOMAINS = new Set<string>();

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

export function parseEasyListDomains(raw: string): string[] {
  const domains: string[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim().toLowerCase();
    if (!line || line.startsWith('!') || line.startsWith('[') || line.startsWith('#')) continue;
    // Match ||domain.com^ (EasyList domain anchor)
    const easylistMatch = line.match(/^\|\|([a-z0-9.-]+\.[a-z]{2,})\^?$/);
    if (easylistMatch?.[1]) {
      domains.push(easylistMatch[1]);
      continue;
    }
    // Match hosts-file lines: 0.0.0.0 domain.com or 127.0.0.1 domain.com
    const hostsMatch = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+([a-z0-9.-]+\.[a-z]{2,})$/);
    if (hostsMatch?.[1] && hostsMatch[1] !== 'localhost') {
      domains.push(hostsMatch[1]);
    }
  }
  return domains;
}

export function loadDynamicFilterList(filePath: string): number {
  try {
    if (!fs.existsSync(filePath)) return 0;
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseEasyListDomains(content);
    DYNAMIC_DOMAINS.clear();
    for (const d of parsed) DYNAMIC_DOMAINS.add(d);
    return DYNAMIC_DOMAINS.size;
  } catch {
    return 0;
  }
}

export async function updateEasyListCache(filePath: string): Promise<number> {
  const res = await fetch(
    'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext',
  );
  if (!res.ok) {
    throw new Error(`No se pudo descargar la lista de filtros (HTTP ${res.status})`);
  }
  const text = await res.text();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf-8');
  return loadDynamicFilterList(filePath);
}

export function isHostInSet(hostname: string, set: Set<string>): boolean {
  const lower = hostname.toLowerCase();
  if (set.has(lower)) return true;
  const parts = lower.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (set.has(parent)) return true;
  }
  return false;
}

export function isBlockedHost(hostname: string): boolean {
  return isHostInSet(hostname, STATIC_DOMAINS) || isHostInSet(hostname, DYNAMIC_DOMAINS);
}

export function isWhitelistedHost(hostname: string, whitelist: string[]): boolean {
  if (!whitelist || whitelist.length === 0) return false;
  const lower = hostname.toLowerCase();
  return whitelist.some((w) => {
    const clean = w.toLowerCase();
    return lower === clean || lower.endsWith(`.${clean}`);
  });
}

export function shouldBlockUrl(url: string, whitelist: string[] = []): boolean {
  try {
    const parsed = new URL(url);
    if (isWhitelistedHost(parsed.hostname, whitelist)) return false;
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
  whitelistedHosts?: string[];
}

export function installAdBlock(
  session: Session,
  getOptions: () => AdBlockOptions,
  getActivePageHost?: () => string | undefined,
  onBlocked?: () => void,
): void {
  session.webRequest.onBeforeRequest((details, callback) => {
    const { adBlockEnabled, trackerBlockEnabled, whitelistedHosts = [] } = getOptions();
    if (!adBlockEnabled && !trackerBlockEnabled) {
      callback({ cancel: false });
      return;
    }
    const pageHost = getActivePageHost?.();
    if (pageHost && isWhitelistedHost(pageHost, whitelistedHosts)) {
      callback({ cancel: false });
      return;
    }
    const blocked = shouldBlockUrl(details.url, whitelistedHosts);
    if (blocked) onBlocked?.();
    callback({ cancel: blocked });
  });
}
