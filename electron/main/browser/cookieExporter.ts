import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Session } from 'electron';

export interface NetscapeCookieInput {
  domain?: string;
  path?: string;
  secure?: boolean;
  expirationDate?: number;
  name: string;
  value: string;
}

export function formatNetscapeCookies(cookies: NetscapeCookieInput[]): string {
  const lines = ['# Netscape HTTP Cookie File'];
  for (const cookie of cookies) {
    if (!cookie.domain || !cookie.name) continue;
    const includeSubdomains = cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const cookiePath = cookie.path || '/';
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    const expires = cookie.expirationDate ? Math.floor(cookie.expirationDate) : 0;
    const value = cookie.value.replace(/[\r\n\t]/g, '');
    lines.push([cookie.domain, includeSubdomains, cookiePath, secure, String(expires), cookie.name, value].join('\t'));
  }
  return `${lines.join('\n')}\n`;
}

export interface ExportedCookieFile {
  filePath: string;
  cleanup: () => void;
}

export async function exportSessionCookiesToNetscapeFile(ses: Session): Promise<ExportedCookieFile | undefined> {
  const cookies = await ses.cookies.get({});
  if (cookies.length === 0) return undefined;

  const content = formatNetscapeCookies(cookies);
  const filePath = path.join(os.tmpdir(), `vidflow-cookies-${crypto.randomUUID()}.txt`);
  fs.writeFileSync(filePath, content, { encoding: 'utf-8', mode: 0o600 });

  return {
    filePath,
    cleanup: () => {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // Best-effort cleanup of temp cookie file.
      }
    },
  };
}

export async function getCookieHeaderForUrl(ses: Session, url: string): Promise<string | undefined> {
  try {
    const cookies = await ses.cookies.get({ url });
    if (cookies.length === 0) return undefined;
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  } catch {
    return undefined;
  }
}
