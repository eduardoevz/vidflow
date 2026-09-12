# Security

## Renderer Isolation

- Every `BrowserWindow` and `BrowserView` is created with
  `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webviewTag: false`.
- The renderer never receives a Node `require`, `process`, or `Buffer` global.
  The only bridge is `electron/preload/index.ts`, which exposes a fixed,
  typed `window.vidflow` object via `contextBridge.exposeInMainWorld`.
- A strict Content-Security-Policy is set on the main app window
  (`default-src 'self'`; no `unsafe-eval`; scripts restricted to `'self'`).
  The embedded navigator's BrowserView is a *separate*, unprivileged web
  context — pages it loads have no access to `window.vidflow` at all.

## IPC

- Every IPC handler in `electron/main/ipc/*` validates its input with a zod
  schema before doing anything. Invalid input is rejected with a typed error,
  never trusted.
- IPC channels are enumerated explicitly in `shared/ipc-contract.ts`; the
  preload script only forwards calls for channels in that contract, so a
  compromised renderer cannot invoke an arbitrary main-process function.

## External Processes

- `yt-dlp`, `ffmpeg`, and (if enabled later) `aria2c` are always invoked via
  `child_process.spawn(binaryPath, argsArray, { shell: false })` —
  **never** via `exec`/string concatenation. User-supplied values (URLs,
  filenames, format ids) are passed as individual array elements, never
  interpolated into a shell string.
- Binary paths are resolved from a fixed, validated location under
  `app.getPath('userData')/bin` (or a system PATH lookup for FFmpeg, if
  present) — never from user input.
- `yt-dlp` releases are fetched only from the official
  `github.com/yt-dlp/yt-dlp` releases API over HTTPS, and their SHA256 is
  checked against the checksum file yt-dlp publishes for the release before
  the binary is used.

## Filesystem

- All destination paths are resolved with `path.resolve` against the
  configured downloads directory and checked with a `path.relative` /
  `startsWith` guard to reject path traversal (`../`) before any write.
- Filenames are sanitized (see `docs/DOWNLOAD_PIPELINE.md`) to remove
  characters invalid on Windows and reserved device names (`CON`, `PRN`,
  `AUX`, `NUL`, `COM1-9`, `LPT1-9`).

## Embedded Browser

- `setWindowOpenHandler` denies all `window.open`/target=_blank navigations
  by default, routing them instead to "open externally" in the user's
  default browser rather than spawning an in-app popup.
- `webRequest.onBeforeRequest` blocks requests to domains present in the
  bundled ad/tracker blocklist before they are sent.
- Only `http:`/`https:` protocols are permitted for navigation; `file:`,
  `javascript:`, and other schemes are rejected in the navigation handler.

## What This App Explicitly Does Not Do

- No DRM circumvention, no decryption of protected streams, no paywall or
  authentication bypass, no CAPTCHA evasion. Detected DRM/protected content
  surfaces as "Contenido protegido o no compatible" and extraction stops.

## Logging

- Logs (`electron/main/logging`) never record full URLs with embedded
  credentials/tokens, cookies, or authentication headers — only the host and
  a redacted path where useful for debugging.
