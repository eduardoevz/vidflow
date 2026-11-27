import { BrowserView, type BrowserWindow, type Session, session, shell } from 'electron';
import {
  COSMETIC_ADBLOCK_CSS,
  installAdBlock,
  shouldBlockUrl,
  type AdBlockOptions,
} from './adBlockFilter';
import { MediaSniffer } from './mediaSniffer';
import { isHttpUrl } from '../security/paths';
import type { DetectedBrowserMedia } from '../../../shared/ipc-contract';

export const BROWSER_PARTITION = 'persist:vidflow-browser';

export interface NavigationState {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  blockedCount?: number;
}

export class BrowserViewController {
  private view: BrowserView | undefined;
  private readonly sniffer: MediaSniffer;
  private blockedCount = 0;

  constructor(
    private readonly parentWindow: BrowserWindow,
    private readonly onNavigationStateChanged: (state: NavigationState) => void,
    private readonly getAdBlockOptions: () => AdBlockOptions,
    onMediaDetected: (items: DetectedBrowserMedia[]) => void = () => undefined,
  ) {
    this.sniffer = new MediaSniffer(onMediaDetected);
  }

  getSession(): Session {
    return session.fromPartition(BROWSER_PARTITION);
  }

  getUserAgent(): string {
    return this.view?.webContents.getUserAgent() ?? this.getSession().getUserAgent();
  }

  getDetectedMedia(): DetectedBrowserMedia[] {
    return this.sniffer.list();
  }

  clearDetectedMedia(): void {
    this.sniffer.clear();
  }

  ensureCreated(): BrowserView {
    if (this.view) return this.view;

    this.view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // A dedicated partition keeps the embedded navigator's cookies/cache
        // and (crucially) its HTTP responses separate from the app window's
        // own session — the app's strict CSP header is only ever attached
        // to session.defaultSession, and would otherwise break most
        // external sites if it applied here too.
        session: this.getSession(),
        // Deliberately no preload script: pages loaded here are untrusted
        // remote content and must have zero access to any VidFlow API.
      },
    });

    // Brave-style popup policy: block all window.open / target="_blank" popups
    // when popupBlockEnabled is true; otherwise fall back to external browser.
    this.view.webContents.setWindowOpenHandler(({ url }) => {
      const opts = this.getAdBlockOptions();
      if (opts.popupBlockEnabled !== false || shouldBlockUrl(url)) {
        this.blockedCount += 1;
        this.emitState();
        return { action: 'deny' };
      }
      if (isHttpUrl(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });

    installAdBlock(this.view.webContents.session, this.getAdBlockOptions, () => {
      this.blockedCount += 1;
      this.emitState();
    });
    this.sniffer.installOnSession(this.view.webContents.session, () => ({
      pageUrl: this.view?.webContents.getURL() ?? '',
      pageTitle: this.view?.webContents.getTitle() ?? '',
    }));

    this.view.webContents.on('did-start-loading', () => this.emitState());
    this.view.webContents.on('did-stop-loading', () => this.emitState());
    this.view.webContents.on('dom-ready', () => {
      if (this.getAdBlockOptions().adBlockEnabled) {
        void this.view?.webContents.insertCSS(COSMETIC_ADBLOCK_CSS).catch(() => undefined);
      }
    });
    this.view.webContents.on('did-navigate', () => {
      this.blockedCount = 0;
      this.sniffer.clear();
      this.emitState();
    });
    this.view.webContents.on('did-navigate-in-page', () => this.emitState());

    // Only http(s) navigations are permitted, and block top-level redirects to ad domains.
    this.view.webContents.on('will-navigate', (event, url) => {
      if (!isHttpUrl(url)) {
        event.preventDefault();
        return;
      }
      const opts = this.getAdBlockOptions();
      if ((opts.adBlockEnabled || opts.popupBlockEnabled !== false) && shouldBlockUrl(url)) {
        event.preventDefault();
        this.blockedCount += 1;
        this.emitState();
      }
    });

    this.parentWindow.addBrowserView(this.view);
    return this.view;
  }

  private emitState(): void {
    if (!this.view) return;
    const wc = this.view.webContents;
    this.onNavigationStateChanged({
      url: wc.getURL(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
      isLoading: wc.isLoading(),
      blockedCount: this.blockedCount,
    });
  }

  setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.view?.setBounds(bounds);
  }

  navigate(url: string): void {
    if (!isHttpUrl(url)) throw new Error('Solo se permiten URLs http(s).');
    void this.ensureCreated().webContents.loadURL(url);
  }

  goBack(): void {
    const wc = this.view?.webContents;
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  }

  goForward(): void {
    const wc = this.view?.webContents;
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  }

  reload(): void {
    this.view?.webContents.reload();
  }

  hide(): void {
    if (this.view) this.parentWindow.removeBrowserView(this.view);
  }

  show(): void {
    if (this.view) this.parentWindow.addBrowserView(this.view);
  }
}
