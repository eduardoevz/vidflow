import path from 'node:path';

/**
 * Resolves `candidate` against `baseDir` and throws if the result would escape
 * `baseDir` (path traversal guard). Returns the resolved absolute path.
 */
export function resolveWithinDirectory(baseDir: string, candidate: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, candidate);
  const relative = path.relative(resolvedBase, resolvedTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path traversal rejected: "${candidate}" escapes "${baseDir}"`);
  }
  return resolvedTarget;
}

const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

// eslint-disable-next-line no-control-regex -- deliberately strips ASCII control chars too
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

export function sanitizeFilename(name: string, maxLength = 180): string {
  let cleaned = name.replace(INVALID_FILENAME_CHARS, '_').trim();
  cleaned = cleaned.replace(/[.\s]+$/, '');
  if (cleaned.length === 0) {
    cleaned = 'untitled';
  }
  const base = cleaned.slice(0, maxLength);
  const nameWithoutExt = base.split('.')[0]?.toUpperCase() ?? '';
  if (WINDOWS_RESERVED_NAMES.has(nameWithoutExt)) {
    return `_${base}`;
  }
  return base;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
