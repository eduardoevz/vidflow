import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderFilenameTemplate, resolveCollisionFreePath } from '../../electron/main/downloads/filenameTemplate';

describe('renderFilenameTemplate', () => {
  it('substitutes placeholders and sanitizes the result', () => {
    const result = renderFilenameTemplate('{author} - {title} - {resolution}', {
      title: 'My: Video?',
      author: 'Channel',
      resolution: '1080p',
    });
    expect(result).toBe('Channel - My_ Video_ - 1080p');
  });

  it('falls back to "Unknown" author when missing', () => {
    const result = renderFilenameTemplate('{author} - {title}', { title: 'Video' });
    expect(result).toBe('Unknown - Video');
  });
});

describe('resolveCollisionFreePath', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vidflow-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns the plain path when there is no collision', () => {
    const result = resolveCollisionFreePath(dir, 'video', 'mp4');
    expect(result).toBe(path.join(dir, 'video.mp4'));
  });

  it('appends " (2)", " (3)", ... on collisions', () => {
    fs.writeFileSync(path.join(dir, 'video.mp4'), '');
    fs.writeFileSync(path.join(dir, 'video (2).mp4'), '');
    const result = resolveCollisionFreePath(dir, 'video', 'mp4');
    expect(result).toBe(path.join(dir, 'video (3).mp4'));
  });
});
