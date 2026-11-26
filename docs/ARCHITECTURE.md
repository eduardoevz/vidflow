# VidFlow Architecture

## Layers

```
Desktop UI (React/TS renderer)
    ↓  typed IPC (contextBridge, validated with zod)
Application Services (main process: settings, history, downloads facade)
    ↓
Media Analysis Layer (MediaAnalyzer: URL validation → site recognition →
                       yt-dlp adapter → generic/manifest detector → normalizer)
    ↓
Extraction Engines (yt-dlp binary; generic direct-media/HLS/DASH prober)
    ↓
Download Engine (DownloadManager: queue, progress, resume, retries)
    ↓
Post-processing (FFmpeg: mux/remux video+audio, audio extraction)
```

Each layer only talks to the layer directly below it through a narrow
TypeScript interface, so any layer can be swapped (e.g. replacing yt-dlp's
version, or adding a new extraction strategy) without touching the UI.

## Process Model (Electron)

- **Main process** (`electron/main`): owns the SQLite database, the
  DownloadManager, the MediaAnalyzer, all child-process spawning, the tray,
  notifications, and the BrowserView(s) used for the embedded navigator. This
  is the only process with filesystem/process/network-privileged code.
- **Preload** (`electron/preload`): the only bridge between renderer and
  main. Exposes a single `window.vidflow` object via `contextBridge`, with one
  function per IPC operation. No Node globals, no `require`, are ever exposed
  to the renderer.
- **Renderer** (`src`): a plain, sandboxed, contextIsolated React app. All
  business logic that must run with privileges lives in main; the renderer
  only orchestrates UI state and calls `window.vidflow.*`.

## Module Map

- `electron/main/database` — better-sqlite3 client, migration runner,
  repositories (`downloadsRepo`, `historyRepo`, `settingsRepo`, `mediaItemsRepo`).
- `electron/main/extraction` — `MediaAnalyzer`, `YtDlpAdapter`, `GenericMediaDetector`,
  `ManifestProbe` (HLS/DASH), `normalizeMediaInfo`.
- `electron/main/downloads` — `DownloadManager`, `DownloadTask` state machine,
  `FfmpegMerger`, `FilenameTemplate`, `filenameSanitizer`.
- `electron/main/engines` — `EngineManager` (yt-dlp/ffmpeg version detection,
  update, checksum verification).
- `electron/main/browser` — `BrowserViewController`, `AdBlockFilter`,
  `PopupPolicy`.
- `electron/main/security` — `spawnSafe` helper, URL/path validators, CSP
  builder.
- `electron/main/tray`, `notifications`, `updater`, `logging` — one
  responsibility each, described by their name.
- `electron/main/ipc` — one file per IPC channel group (`analyze.ipc.ts`,
  `downloads.ipc.ts`, `settings.ipc.ts`, `history.ipc.ts`, `system.ipc.ts`),
  each validating its input with a zod schema before calling into services.
- `shared/types` — the normalized `MediaInfo`/`MediaFormat`/etc. types and IPC
  contract types, imported by both main and renderer so they never drift.
- `src/features/*` — one folder per screen (browser, analyzer, downloads,
  history, player, settings), each owning its components/hooks/store slice.

## Data Flow: Analyze → Download

1. User submits a URL in `features/analyzer` → `window.vidflow.analyzeUrl(url)`.
2. Main's `analyze.ipc` validates the URL shape, calls `MediaAnalyzer.analyze`.
3. `MediaAnalyzer` tries `YtDlpAdapter` first; on failure, falls back to
   `GenericMediaDetector` / `ManifestProbe`; on total failure, returns a
   categorized `AnalysisError` (unsupported/protected/auth-required/network/...).
4. Successful results are normalized into `MediaInfo` and returned to the
   renderer — the UI never sees raw yt-dlp JSON.
5. User picks a format (or a smart preset) → `window.vidflow.startDownload(...)`.
6. `DownloadManager` enqueues a `DownloadTask`, moves it through its state
   machine, emits throttled progress events over IPC, invokes `FfmpegMerger`
   when video+audio are separate streams, and on completion writes a row to
   both `downloads` and `history` (via `media_items`).

## Extensibility / Durability

- Extraction strategies implement a common `ExtractionStrategy` interface, so
  a new one can be added without touching the analyzer's orchestration logic.
- `yt-dlp` and `ffmpeg` are external, independently-updatable binaries managed
  by `EngineManager` — the app does not need to be rebuilt to pick up a newer
  extractor.
- `aria2c` is supported as an optional high-speed multi-connection download backend
  (for both yt-dlp delegation and direct HTTP downloads via `Aria2DownloadBackend`),
  auto-provisioned by `EngineManager` and configured in Settings.

## Offline Behavior

History, settings, search/filter, local file playback, and folder browsing
all work fully offline (they only touch SQLite and the local filesystem).
Analyzing a URL and downloading obviously require network connectivity.
