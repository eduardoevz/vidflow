import { describe, expect, it } from 'vitest';
import { parseYtDlpProgressLine } from '../../electron/main/downloads/progressParser';

describe('parseYtDlpProgressLine', () => {
  it('parses percent, size, speed and MM:SS eta', () => {
    const result = parseYtDlpProgressLine('[download]  42.0% of 10.00MiB at 1.23MiB/s ETA 00:07');
    expect(result?.percent).toBe(42.0);
    expect(result?.totalBytes).toBeCloseTo(10 * 1024 * 1024, 0);
    expect(result?.speedBytesPerSec).toBeCloseTo(1.23 * 1024 * 1024, 0);
    expect(result?.etaSeconds).toBe(7);
  });

  it('parses an estimated size (~) and H:MM:SS eta', () => {
    const result = parseYtDlpProgressLine('[download]  5.0% of ~1.50GiB at 500.00KiB/s ETA 01:02:03');
    expect(result?.percent).toBe(5.0);
    expect(result?.totalBytes).toBeCloseTo(1.5 * 1024 ** 3, 0);
    expect(result?.etaSeconds).toBe(1 * 3600 + 2 * 60 + 3);
  });

  it('returns undefined for unrelated lines', () => {
    expect(parseYtDlpProgressLine('[Merger] Merging formats into "out.mp4"')).toBeUndefined();
    expect(parseYtDlpProgressLine('random log line')).toBeUndefined();
  });
});
