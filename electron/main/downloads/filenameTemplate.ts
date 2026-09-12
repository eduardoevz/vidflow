import fs from 'node:fs';
import path from 'node:path';
import { sanitizeFilename } from '../security/paths';

export interface FilenameContext {
  title: string;
  author?: string;
  resolution?: string;
  date?: string; // YYYY-MM-DD
}

export function renderFilenameTemplate(template: string, ctx: FilenameContext): string {
  const rendered = template
    .replace('{title}', ctx.title)
    .replace('{author}', ctx.author ?? 'Unknown')
    .replace('{resolution}', ctx.resolution ?? '')
    .replace('{date}', ctx.date ?? new Date().toISOString().slice(0, 10));
  return sanitizeFilename(rendered.replace(/\s{2,}/g, ' ').trim());
}

/** Appends " (2)", " (3)", ... before the extension until the path is free. */
export function resolveCollisionFreePath(directory: string, filename: string, extension: string): string {
  let candidate = `${filename}.${extension}`;
  let counter = 2;
  while (fs.existsSync(path.join(directory, candidate))) {
    candidate = `${filename} (${counter}).${extension}`;
    counter += 1;
  }
  return path.join(directory, candidate);
}
