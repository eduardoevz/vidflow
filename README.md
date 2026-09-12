# VidFlow

VidFlow is a Windows desktop application for analyzing a web page containing
video, inspecting the media it exposes, and downloading it (video, audio, or
both merged) in the quality you choose — with a real download queue, history,
and an embedded, ad-blocked browser. It is built to stay maintainable as sites
change: extraction is layered so the extractor engine (`yt-dlp`) can be
updated independently of the app itself.

## Architecture

```
Desktop UI (React/TS)
    ↓ typed IPC (contextBridge + zod validation)
Application Services (settings, history, downloads facade)
    ↓
Media Analysis Layer (yt-dlp → generic direct-media → HLS/DASH manifest probe)
    ↓
Extraction Engines (yt-dlp binary; local Node fallbacks)
    ↓
Download Engine (queue, progress, resume, retries)
    ↓
Post-processing (FFmpeg mux/remux, audio extraction)
```

See `docs/ARCHITECTURE.md` for the full module map, `docs/ADR-001-desktop-runtime.md`
for why Electron was chosen over Tauri, `docs/DATA_MODEL.md` for the SQLite
schema, `docs/SECURITY.md` for the security model, and
`docs/DOWNLOAD_PIPELINE.md` for how extraction/download/merge actually works.

## Stack

- Electron + `electron-builder` (NSIS Windows installer)
- React 18 + TypeScript (strict) + Vite + Tailwind CSS
- GSAP for UI motion (respects `prefers-reduced-motion`)
- `better-sqlite3` for local persistence, forward-only SQL migrations
- `yt-dlp` (external, managed, self-updating binary) as the primary extraction/download engine
- FFmpeg for muxing/remuxing and audio extraction

## Project Structure

```
src/                  renderer (React/TS) — app shell, features, stores
electron/main/        main process — ipc, extraction, downloads, database,
                       engines, browser, security, logging, tray, notifications, updater
electron/preload/     the only bridge exposed to the renderer (window.vidflow)
shared/                types + logic shared by both processes (no Electron/Node imports)
database/migrations/  raw SQL migrations
docs/                  architecture, security, data model, download pipeline docs
tests/                 unit + integration tests (Vitest), fixtures
```

## Development

```bash
npm install
npm run dev            # Vite dev server on :5173
npm run dev:electron    # compiles main/preload, rebuilds better-sqlite3 for
                        # Electron's ABI, and launches Electron pointed at
                        # the Vite dev server above (run both together)
```

### A note on `better-sqlite3` and native module ABI

`better-sqlite3` is a native module. Vitest runs under plain Node, but the
packaged/dev Electron app runs its own bundled Node ABI — the same compiled
binary cannot serve both at once. Two scripts handle this:

- `npm test` rebuilds it for the current system Node before running Vitest.
- `npm run dev:electron` / `npm run build:win` rebuild it for Electron's ABI
  (via `@electron/rebuild`) before launching/packaging.

If you run tests right after running the app (or vice versa), the relevant
script above re-rebuilds it automatically — you don't need to do this by hand.

### A note on `electron-builder` and `winCodeSign`

`electron-builder` normally fetches a `winCodeSign` helper package (macOS
signing tools bundled alongside Windows tooling) before packaging, even for
an unsigned Windows-only build. On a machine without Developer Mode enabled
(no permission to create symlinks as a non-elevated user), extracting that
package fails and `electron-builder` retries indefinitely. This repo's
`package.json` sets `build.win.signAndEditExecutable: false`, which skips
that step entirely — safe for an unsigned build. If you configure real code
signing later, revisit this setting.

### Windows build prerequisites

Building the `better-sqlite3` native binding from source requires the
"Desktop development with C++" workload from Visual Studio (or Build Tools).
If `npm install` fails on `better-sqlite3` with a `node-gyp`/"Could not find
Visual Studio" error, install that workload, or ensure your installed
`node-gyp` version recognizes your Visual Studio version (this repo pins an
`overrides` entry for `node-gyp` in `package.json` for that reason).

## Build

```bash
npm run build       # renderer (Vite) + main/preload (tsc)
npm run build:win   # full Windows installer via electron-builder (NSIS)
```

Output: `release/*.exe` (NSIS installer), plus the unpacked app under `release/win-unpacked/`.

## Tests / Lint / Typecheck

```bash
npm run lint
npm run typecheck
npm test
```

## Updating the extraction/media engines

- **yt-dlp**: Settings → Herramientas → "Comprobar actualizaciones" / "Actualizar
  motor". Under the hood, `EngineManager` downloads the latest Windows binary
  from yt-dlp's official GitHub releases and verifies it against the
  published SHA-256 checksum before installing it under
  `%APPDATA%/VidFlow/bin/yt-dlp.exe`. It never fetches binaries from
  unofficial sources.
- **FFmpeg**: VidFlow looks for a managed copy under `%APPDATA%/VidFlow/bin`
  first, then falls back to a `ffmpeg` found on `PATH`. There is currently no
  automatic FFmpeg installer wired up (see "Next steps" below) — if FFmpeg is
  missing entirely, video+audio merging and audio extraction will fail with a
  clear error rather than silently doing nothing.
- **App itself**: `electron/main/updater/updateService.ts` is a deliberate
  no-op today — there is no release feed configured yet. To wire up real
  auto-updates later: stand up a GitHub Releases (or generic) feed,
  point `electron-updater` at it, and replace `UpdateService`'s body.

## Creating a release

1. Bump `version` in `package.json`.
2. `npm run build:win`.
3. Publish `release/VidFlow-Setup-<version>.exe` (or whatever electron-builder
   names it) wherever you distribute builds. There is no automated publish
   step configured (see `docs/ARCHITECTURE.md`).

## Known Limitations (read before filing a bug)

- No downloader can guarantee permanent support for every site — sites change
  their pages/APIs, and `yt-dlp` has to be updated to keep up. Use
  Settings → Herramientas to update it.
- DRM-protected content is never supported by design — VidFlow will report
  "Contenido protegido o no compatible" rather than attempt to circumvent it.
- Sites that require login/authentication are not automated — VidFlow does
  not attempt to bypass auth walls or CAPTCHAs.
- Some reported file sizes are estimates (`~123 MB estimados`), particularly
  for HLS/DASH sources whose manifests don't declare an exact size — the UI
  always marks these visually, never presents them as exact.
- Not every source supports resuming a partially-downloaded file; this
  depends on whether the server/protocol supports HTTP range requests.
- The ad/tracker blocklist bundled in `electron/main/browser/adblockDomains.json`
  is a small, illustrative curated list, not a full EasyList — extend it as
  needed.

## Security

See `docs/SECURITY.md`. Summary: strict `contextIsolation`/`sandbox`/no
`nodeIntegration` everywhere, a narrow validated IPC surface, no shell-string
process spawning (always `spawn(binary, argsArray)`), path-traversal and
Windows-reserved-filename guards, and yt-dlp binaries are checksum-verified
against the official release before use.
