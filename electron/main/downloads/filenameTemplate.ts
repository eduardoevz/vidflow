import fs from 'node:fs';
import path from 'node:path';
import { resolveWithinDirectory, sanitizeFilename } from '../security/paths';

export interface FilenameContext {
  title: string;
  author?: string;
  site?: string;
  resolution?: string;
  date?: string; // YYYY-MM-DD
}

export function renderFilenameTemplate(template: string, ctx: FilenameContext): string {
  const rawSegments = template.split(/[/\\]+/).filter(Boolean);
  const segments = rawSegments.length > 0 ? rawSegments : ['{title}'];

  const sanitizedSegments = segments
    .map((seg) => {
      const rendered = seg
        .replace(/\{title\}/g, ctx.title)
        .replace(/\{author\}/g, ctx.author ?? 'Unknown')
        .replace(/\{site\}/g, ctx.site ?? 'web')
        .replace(/\{resolution\}/g, ctx.resolution ?? '')
        .replace(/\{date\}/g, ctx.date ?? new Date().toISOString().slice(0, 10));
      const cleaned = rendered.replace(/\s{2,}/g, ' ').trim();
      if (cleaned === '.' || cleaned === '..') return 'untitled';
      return sanitizeFilename(cleaned);
    })
    .filter(Boolean);

  return sanitizedSegments.length > 0 ? sanitizedSegments.join(path.sep) : 'untitled';
}

/** Appends " (2)", " (3)", ... before the extension until the path is free, guarding against traversal. */
export function resolveCollisionFreePath(directory: string, filename: string, extension: string): string {
  let candidate = `${filename}.${extension}`;
  let resolved = resolveWithinDirectory(directory, candidate);
  let counter = 2;
  while (fs.existsSync(resolved)) {
    candidate = `${filename} (${counter}).${extension}`;
    resolved = resolveWithinDirectory(directory, candidate);
    counter += 1;
  }
  return resolved;
}
