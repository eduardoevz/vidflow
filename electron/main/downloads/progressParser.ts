export interface ParsedProgress {
  percent: number;
  totalBytes?: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
}

const UNIT_MULTIPLIERS: Record<string, number> = {
  B: 1,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
};

function parseSize(value: string, unit: string): number | undefined {
  const multiplier = UNIT_MULTIPLIERS[unit];
  if (!multiplier) return undefined;
  return Number(value) * multiplier;
}

/**
 * Parses a single line of yt-dlp's `--newline` progress output, e.g.:
 * "[download]  42.0% of 10.00MiB at 1.23MiB/s ETA 00:07"
 * "[download]  42.0% of ~10.00MiB at Unknown ETA Unknown"
 */
export function parseYtDlpProgressLine(line: string): ParsedProgress | undefined {
  const match =
    /\[download]\s+(\d+(?:\.\d+)?)% of\s+~?(\d+(?:\.\d+)?)(B|KiB|MiB|GiB)(?:\s+at\s+([\d.]+)(B|KiB|MiB|GiB)\/s)?(?:\s+ETA\s+(\d+):(\d+)(?::(\d+))?)?/.exec(
      line,
    );
  if (!match) return undefined;

  const [, percentStr, sizeVal, sizeUnit, speedVal, speedUnit, h, m, s] = match;
  const percent = Number(percentStr);
  const totalBytes = sizeVal && sizeUnit ? parseSize(sizeVal, sizeUnit) : undefined;
  const speedBytesPerSec = speedVal && speedUnit ? parseSize(speedVal, speedUnit) : undefined;

  let etaSeconds: number | undefined;
  if (s !== undefined) {
    etaSeconds = Number(h) * 3600 + Number(m) * 60 + Number(s);
  } else if (m !== undefined && h !== undefined) {
    etaSeconds = Number(h) * 60 + Number(m);
  }

  return { percent, totalBytes, speedBytesPerSec, etaSeconds };
}
