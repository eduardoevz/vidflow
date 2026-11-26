<div align="center">

# VidFlow

**Modern, privacy-first Windows desktop media analyzer, browser, and multi-connection downloader.**

[![Electron](https://img.shields.io/badge/Electron-32-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

</div>

---

VidFlow is a Windows desktop application built with Electron, React, and TypeScript to inspect web pages containing video, choose the exact quality and file size you want, and download media (video, audio, or merged streams) with a persistent download queue, searchable history, and an embedded ad-blocked browser that automatically detects video streams.

---

## Highlights

- **Smart Media Analysis & Quality Picker** — Paste any supported URL on **Inicio** or **Descargas** to inspect available resolutions, bitrates, codecs, and exact or estimated file sizes before downloading.
- **Embedded Browser with Live Media Sniffer** — Browse sites inside VidFlow's sandboxed `BrowserView` (with built-in ad/tracker blocking). As pages load `.m3u8` (HLS), `.mpd` (DASH), or direct video streams, VidFlow captures them automatically and surfaces a **`Videos (N)`** drawer for one-click analysis.
- **Session Cookie & Referer Forwarding** — Authenticated sessions and `Referer` / `User-Agent` headers from the embedded browser are securely forwarded to `yt-dlp`, `aria2c`, and HTTP downloaders when analyzing and downloading protected streams.
- **Multi-Engine Download Pipeline** — Managed `yt-dlp` (with in-app updates), auto-provisioned `FFmpeg` (for muxing and audio extraction), and optional `aria2c` multi-connection acceleration.
- **Persistent Queue & History** — Pause, resume, retry, or cancel active downloads, track real-time speed/ETA, and search or manage completed files in SQLite-backed history.
- **Security by Design** — Strict `contextIsolation`, `sandbox: true`, `nodeIntegration: false`, Zod-validated IPC, argument-array process spawning (no shell injection), and SHA-256 verified engine downloads.

---

## Architecture

```text
Desktop UI (React 18 + Tailwind CSS + GSAP + Zustand)
        │  typed IPC (contextBridge + Zod validation)
        ▼
Main Process (Electron)
  ├── BrowserView + MediaSniffer + CookieExporter (persist:vidflow-browser)
  ├── MediaAnalyzer (yt-dlp → GenericMediaDetector → HLS/DASH ManifestProbe)
  ├── DownloadManager (queue, concurrency, pause/resume/retry)
  │     ├── yt-dlp + FFmpeg (mux/remux & audio extraction)
  │     └── aria2c / resumable HTTP(S) backend
  └── SQLite (better-sqlite3 with forward-only migrations)
```

For deeper technical details, see:
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Module map and process boundaries
- [`docs/DOWNLOAD_PIPELINE.md`](docs/DOWNLOAD_PIPELINE.md) — Extraction fallback chain, merging, and download backends
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — SQLite schema and migrations
- [`docs/SECURITY.md`](docs/SECURITY.md) — Sandbox, CSP, IPC validation, and path guards
- [`docs/ADR-001-desktop-runtime.md`](docs/ADR-001-desktop-runtime.md) — Why Electron was chosen

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Desktop Shell** | Electron 32 + `electron-builder` (Windows NSIS) |
| **Frontend** | React 18, TypeScript (strict), Vite, Tailwind CSS, Lucide Icons, GSAP, Zustand |
| **Media Engines** | `yt-dlp` (self-updating), `FFmpeg` (auto-provisioned), `aria2c` (optional accelerator) |
| **Persistence** | `better-sqlite3` (local SQLite with SQL migrations) |
| **Testing & Quality** | Vitest, Playwright (Electron E2E), ESLint, TypeScript `--noEmit` |

---

## Project Structure

```text
src/                  Renderer (React/TS) — app shell, features, stores, components
electron/main/        Main process — IPC, extraction, downloads, database, engines, browser, security
electron/preload/     Sandboxed preload bridge (window.vidflow)
shared/               Shared TypeScript types, quality selection, and IPC contracts
database/migrations/  Forward-only SQLite migrations
tests/                Unit & integration tests (Vitest) + fixtures
docs/                 Architecture, security, data model, and pipeline docs
```

---

## Getting Started

### Prerequisites (Windows)
- **Node.js** 20+ and **npm**
- **Visual Studio Build Tools** with *"Desktop development with C++"* (required by `node-gyp` to compile `better-sqlite3` native bindings).

### Development

```bash
npm install
npm run dev            # Starts the Vite renderer dev server on :5173
npm run dev:electron   # Builds main/preload, rebuilds better-sqlite3 for Electron, and launches the app
```

> **Note on `better-sqlite3` ABI:** `npm test` rebuilds `better-sqlite3` for your system Node.js ABI, while `npm run dev:electron` and `npm run build:win` rebuild it for Electron's ABI automatically.

---

## Building for Windows

```bash
npm run build          # Builds renderer (Vite) + main/preload (tsc + esbuild)
npm run build:win      # Packages NSIS installer & unpacked app into release/
```

Outputs:
- `release/VidFlow Setup <version>.exe` — Windows NSIS installer
- `release/win-unpacked/VidFlow.exe` — Portable unpacked executable

---

## Verification

```bash
npm run typecheck      # Strict TypeScript check (renderer + electron)
npm run lint           # ESLint across all .ts/.tsx files
npm test               # Rebuilds SQLite for Node and runs the Vitest suite
```

---

## Known Limitations

- **DRM-Protected Streams:** Content protected with Widevine/PlayReady (e.g., Netflix, Prime Video, Disney+) is never supported and cannot be decrypted.
- **Site Compatibility:** Sites frequently update their players and APIs; use **Ajustes → Herramientas** to keep `yt-dlp` up to date.
- **Estimated File Sizes:** Streams from HLS/DASH manifests or generic extractors without a `Content-Length` header display an estimated size (`~XX MB estimados`) derived from bitrate and duration.
