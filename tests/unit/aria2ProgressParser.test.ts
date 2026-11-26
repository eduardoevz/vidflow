import { describe, expect, it } from 'vitest';
import { parseAria2ProgressLine } from '../../electron/main/downloads/progressParser';

describe('parseAria2ProgressLine', () => {
  it('parses a real captured summary line with CN and ETA', () => {
    const result = parseAria2ProgressLine('[#b6a9a6 96KiB/2.3MiB(3%) CN:3 DL:1.1MiB ETA:1s]');
    expect(result?.downloadedBytes).toBeCloseTo(96 * 1024, 0);
    expect(result?.totalBytes).toBeCloseTo(2.3 * 1024 * 1024, 0);
    expect(result?.percent).toBe(3);
    expect(result?.speedBytesPerSec).toBeCloseTo(1.1 * 1024 * 1024, 0);
    expect(result?.etaSeconds).toBe(1);
  });

  it('parses minutes/hours ETA units', () => {
    const result = parseAria2ProgressLine('[#abc123 1.0MiB/100.0MiB(1%) CN:4 DL:500KiB ETA:2m]');
    expect(result?.etaSeconds).toBe(120);
  });

  it('handles a line with no total size / percent / ETA (unknown length)', () => {
    const result = parseAria2ProgressLine('[#abc123 1.0MiB DL:500KiB]');
    expect(result?.downloadedBytes).toBeCloseTo(1 * 1024 * 1024, 0);
    expect(result?.totalBytes).toBeUndefined();
    expect(result?.percent).toBeUndefined();
  });

  it('returns undefined for unrelated lines', () => {
    expect(parseAria2ProgressLine('09/11 21:46:30 [NOTICE] Downloading 1 item(s)')).toBeUndefined();
    expect(parseAria2ProgressLine('random log line')).toBeUndefined();
  });
});
