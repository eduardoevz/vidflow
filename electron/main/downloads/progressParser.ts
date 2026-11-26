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

export interface ParsedAria2Progress {
  downloadedBytes: number;
  totalBytes?: number;
  percent?: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
}

const ETA_UNIT_MULTIPLIERS: Record<string, number> = { s: 1, m: 60, h: 3600 };

/**
 * Parses aria2c's periodic one-line summary (enabled via
 * `--summary-interval=1 --console-log-level=notice`), e.g.:
 * "[#b6a9a6 96KiB/2.3MiB(3%) CN:3 DL:1.1MiB ETA:1s]"
 * The `(pct%)`, `CN:n` and `ETA:` segments can all be absent (e.g. when the
 * total size is unknown), so only the leading gid/downloaded/unit is
 * required for a match.
 */
export function parseAria2ProgressLine(line: string): ParsedAria2Progress | undefined {
  const match =
    /\[#\w+\s+([\d.]+)(B|KiB|MiB|GiB)(?:\/([\d.]+)(B|KiB|MiB|GiB)\((\d+)%\))?(?:\s+CN:\d+)?(?:\s+DL:([\d.]+)(B|KiB|MiB|GiB))?(?:\s+ETA:(\d+)([hms]))?/.exec(
      line,
    );
  if (!match) return undefined;

  const [, dlVal, dlUnit, totalVal, totalUnit, percentStr, speedVal, speedUnit, etaVal, etaUnit] = match;
  // dlVal/dlUnit are always captured when the regex matches at all (they are
  // not inside an optional group), unlike the rest — TS just can't see that.
  const downloadedBytes = (dlVal && dlUnit ? parseSize(dlVal, dlUnit) : undefined) ?? 0;
  const totalBytes = totalVal && totalUnit ? parseSize(totalVal, totalUnit) : undefined;
  const percent = percentStr !== undefined ? Number(percentStr) : undefined;
  const speedBytesPerSec = speedVal && speedUnit ? parseSize(speedVal, speedUnit) : undefined;
  const etaSeconds =
    etaVal && etaUnit ? Number(etaVal) * (ETA_UNIT_MULTIPLIERS[etaUnit] ?? 1) : undefined;

  return { downloadedBytes, totalBytes, percent, speedBytesPerSec, etaSeconds };
}
