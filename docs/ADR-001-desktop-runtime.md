# ADR-001: Desktop Runtime — Electron vs Tauri

## Status
Accepted — 2026-09-11

## Context
VidFlow needs an embedded, navigable browser surface (back/forward, URL bar,
popup blocking, ad/tracker blocking via request interception), robust child
process management for `yt-dlp`/`ffmpeg` (and optionally `aria2c`), SQLite
persistence, native OS integration (tray, notifications, file pickers), and a
credible path to a signed Windows installer. Two realistic runtimes exist:
**Electron** (Chromium + Node.js) and **Tauri** (native WebView2 wrapper + Rust
backend).

Environment check performed before deciding: the development machine has
Node 24.19 / npm 11.17 installed, but **no Rust toolchain, no MSVC Build
Tools, and no existing Cargo/Tauri setup**. Tauri would require provisioning
that toolchain before a single line of application code could run.

## Decision
**Electron.**

## Rationale

1. **Embedded browser & request interception (the spec's own tie-breaker).**
   Electron's `session.webRequest` API (`onBeforeRequest`, `onHeadersReceived`,
   `onBeforeSendHeaders`) gives first-class, well-documented, Chromium-level
   control over every request a loaded page makes — exactly what is needed for
   domain-based ad/tracker blocking. `webContents.setWindowOpenHandler` gives
   precise, synchronous popup control. Tauri's WebView2-on-Windows backend
   exposes a much thinner, less consistent interception surface; reliable
   ad/tracker/popup blocking on Tauri would require fragile, WebView2-specific
   workarounds rather than a documented API.

2. **Toolchain fit.** Electron needs only Node/npm, both already installed.
   Tauri needs Rust + Cargo + MSVC Build Tools + the WebView2 SDK, none of
   which are present — an unforced additional setup burden with no
   functional upside for this specific app.

3. **Child process management.** Both runtimes can `spawn` external binaries
   safely with argument arrays. Electron's story is plain Node `child_process`,
   which every contributor already knows; no advantage to Tauri here.

4. **Ecosystem maturity for this exact shape of app.** Prior art for
   "download manager with embedded browser and ad blocking" (e.g. video
   downloader tools, and Electron's own popularity for browser-adjacent apps)
   is overwhelmingly Electron-based. `electron-builder` produces a well-trodden
   NSIS Windows installer.

## Consequences

- **Accepted trade-off:** Electron produces a larger installer and higher
  idle memory footprint than Tauri. The spec explicitly says installer size
  is not the deciding criterion, so this is an acceptable, informed trade.
- Security must be handled deliberately since Electron ships a full Chromium:
  `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` for
  every window/BrowserView, a narrow typed preload/IPC surface, and a strict
  CSP (see `docs/SECURITY.md`).
- The renderer process never touches Node APIs directly; all filesystem,
  process-spawning, and database access happens in the main process behind
  validated IPC handlers.
- `aria2c` integration, if pursued later, spawns the same way `yt-dlp`/
  `ffmpeg` do — no runtime-specific blocker either way.

## Alternatives Considered

- **Tauri**: rejected for this project due to the toolchain gap and the
  weaker embedded-browser/request-interception story on Windows. Revisit
  only if a future requirement drops the embedded-browser feature entirely
  and installer size/RAM become the dominant constraint.
