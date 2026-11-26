# Download Pipeline

## Extraction Fallback Chain

```
Strategy A: yt-dlp (--dump-json)
    ↓ fails
Strategy B: Generic direct-media detector (.mp4/.webm/.m4v content-type sniff)
    ↓ fails
Strategy C: Manifest probe (HLS .m3u8 / DASH .mpd parsing)
    ↓ fails
Result: categorized failure — Unsupported / Protected (DRM) / Authentication
        required / Network error — never a bare "something went wrong"
```

Each strategy implements the same `ExtractionStrategy` interface
(`analyze(url): Promise<MediaInfo>` that throws a typed `AnalysisError`), so
the orchestrator (`MediaAnalyzer`) is a short, linear "try each in order"
loop, not a growing pile of site-specific branches.

## Download Backends

- **Default (MVP): yt-dlp's native downloader**, with concurrent-fragment
  downloading (`--concurrent-fragments N`, configurable) for HLS/DASH sources
  — this satisfies "maximum reasonable speed" without a second managed binary.
- **`aria2c` (multi-connection accelerator)**: selectable as an alternate
  download engine in Settings (`downloadEngine: 'aria2'`). When enabled:
  - For yt-dlp downloads, yt-dlp delegates chunk fetching to aria2c via
    `--downloader <path>` and `--downloader-args "aria2c:-x <N> -s <N> -k 1M"`.
  - For direct progressive HTTP / generic manifest downloads,
    `Aria2DownloadBackend` spawns `aria2c` directly with multi-connection
    support and real-time progress parsing.
  - Automatically provisioned at startup (downloaded from official GitHub
    releases if not found on PATH). Degrades gracefully to yt-dlp native if
    unavailable.

## Video + Audio Merge

When the selected quality requires separate video-only and audio-only
streams (common on YouTube above a given resolution):

1. Both streams download into a temp directory under
   `app.getPath('temp')/vidflow/<taskId>/`.
2. `FfmpegMerger` runs `ffmpeg -i video -i audio -c copy -map 0:v:0 -map 1:a:0 out.mp4`
   (stream copy — no re-encode) whenever the containers are compatible;
   falls back to a minimal re-encode only if a stream copy is rejected by
   ffmpeg, and logs that this happened.
3. The user only ever sees one logical download with a `merging` status
   ("Procesando video y audio...") — the two-stream detail is not exposed.
4. Temp files are deleted after a successful merge; on failure they're kept
   briefly for retry, then cleaned up by a periodic sweep.

## Filenames

Templates (`{title}`, `{title} - {resolution}`, `{author} - {title}`,
`{date} - {title}`) are rendered, then sanitized: strip
`< > : " / \ | ? *` and control characters, trim trailing dots/spaces,
reject Windows-reserved device names, cap total path length. Collisions
append ` (2)`, ` (3)`, etc. before the extension.

## Progress Reporting

`yt-dlp`'s `--newline` progress output is parsed line-by-line and throttled
to at most ~5 emitted IPC events/sec/task (coalescing intermediate updates)
so the renderer and its React state never get flooded.

## Resume

For sources that support HTTP range requests, `yt-dlp`'s own `--continue`
behavior is used; partially-downloaded parts left on disk after an app
restart are detected and offered for resume rather than silently restarted
from zero. Not all sources support this — the UI does not claim resume where
the protocol doesn't allow it.

## Known Limitations (documented honestly, not hidden)

- No downloader can guarantee permanent support for every site; site changes
  can break extraction until `yt-dlp` is updated.
- DRM-protected content is never supported, by design.
- Some sites require authentication that this app does not attempt to
  automate or bypass.
- Filesizes are sometimes only estimates (HLS/DASH manifests often omit
  exact sizes) — the UI always marks estimates with `~` and distinguishes
  them from exact sizes.
- Some streaming protocols do not support resuming a partial download.
