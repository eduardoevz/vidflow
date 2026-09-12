import { BrowserView, type BrowserWindow, session, shell } from 'electron';
import { installAdBlock, type AdBlockOptions } from './adBlockFilter';
import { isHttpUrl } from '../security/paths';

export interface NavigationState {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

export class BrowserViewController {
  private view: BrowserView | undefined;

  constructor(
    private readonly parentWindow: BrowserWindow,
    private readonly onNavigationStateChanged: (state: NavigationState) => void,
    private readonly getAdBlockOptions: () => AdBlockOptions,
  ) {}

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
        session: session.fromPartition('persist:vidflow-browser'),
        // Deliberately no preload script: pages loaded here are untrusted
        // remote content and must have zero access to any VidFlow API.
      },
    });

    // Popup policy: never open an in-app popup window; route to the
    // default external browser instead (spec §9/§10).
    this.view.webContents.setWindowOpenHandler(({ url }) => {
      if (isHttpUrl(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });

    installAdBlock(this.view.webContents.session, this.getAdBlockOptions);

    this.view.webContents.on('did-start-loading', () => this.emitState());
    this.view.webContents.on('did-stop-loading', () => this.emitState());
    this.view.webContents.on('did-navigate', () => this.emitState());
    this.view.webContents.on('did-navigate-in-page', () => this.emitState());

    // Only http(s) navigations are permitted inside the embedded browser.
    this.view.webContents.on('will-navigate', (event, url) => {
      if (!isHttpUrl(url)) event.preventDefault();
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
