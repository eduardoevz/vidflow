import path from 'node:path';
import { app, BrowserView, type BrowserWindow, type Session, session, shell } from 'electron';
import {
  COSMETIC_ADBLOCK_CSS,
  installAdBlock,
  isWhitelistedHost,
  loadDynamicFilterList,
  shouldBlockUrl,
  updateEasyListCache,
  type AdBlockOptions,
} from './adBlockFilter';
import { MediaSniffer } from './mediaSniffer';
import { isHttpUrl } from '../security/paths';
import type { BrowserTabInfo, DetectedBrowserMedia } from '../../../shared/ipc-contract';

export const BROWSER_PARTITION = 'persist:vidflow-browser';

export interface NavigationState {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  blockedCount?: number;
  activeTabId?: string;
  tabs?: BrowserTabInfo[];
}

interface TabEntry {
  id: string;
  view: BrowserView;
  blockedCount: number;
}

export class BrowserViewController {
  private readonly tabs = new Map<string, TabEntry>();
  private activeTabId: string | undefined;
  private lastBounds: { x: number; y: number; width: number; height: number } | undefined;
  private isVisible = false;
  private sessionHooksInstalled = false;
  private nextTabNum = 1;
  private readonly sniffer: MediaSniffer;

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

  private getFilterListPath(): string {
    return path.join(app.getPath('userData'), 'adblock-easylist.txt');
  }

  async updateFilterLists(): Promise<number> {
    return updateEasyListCache(this.getFilterListPath());
  }

  private ensureSessionHooks(): void {
    if (this.sessionHooksInstalled) return;
    this.sessionHooksInstalled = true;
    const browserSession = this.getSession();
    loadDynamicFilterList(this.getFilterListPath());

    installAdBlock(
      browserSession,
      this.getAdBlockOptions,
      () => this.getActiveHostname(),
      () => {
        const tab = this.getActiveTab();
        if (tab) {
          tab.blockedCount += 1;
          this.emitState();
        }
      },
    );

    this.sniffer.installOnSession(browserSession, () => ({
      pageUrl: this.getActiveTab()?.view.webContents.getURL() ?? '',
      pageTitle: this.getActiveTab()?.view.webContents.getTitle() ?? '',
    }));
  }

  private getActiveTab(): TabEntry | undefined {
    if (!this.activeTabId) return undefined;
    return this.tabs.get(this.activeTabId);
  }

  private getActiveHostname(): string | undefined {
    const rawUrl = this.getActiveTab()?.view.webContents.getURL();
    if (!rawUrl) return undefined;
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return undefined;
    }
  }

  getUserAgent(): string {
    return this.getActiveTab()?.view.webContents.getUserAgent() ?? this.getSession().getUserAgent();
  }

  getDetectedMedia(): DetectedBrowserMedia[] {
    return this.sniffer.list();
  }

  clearDetectedMedia(): void {
    this.sniffer.clear();
  }

  createTab(initialUrl?: string): string {
    this.ensureSessionHooks();
    const id = `tab-${this.nextTabNum++}`;
    const view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        session: this.getSession(),
      },
    });

    const entry: TabEntry = { id, view, blockedCount: 0 };
    this.tabs.set(id, entry);

    view.webContents.setWindowOpenHandler(({ url }) => {
      const opts = this.getAdBlockOptions();
      const activeHost = this.getActiveHostname();
      const whitelisted = activeHost ? isWhitelistedHost(activeHost, opts.whitelistedHosts ?? []) : false;

      if (!whitelisted && (opts.popupBlockEnabled !== false || shouldBlockUrl(url))) {
        entry.blockedCount += 1;
        if (this.activeTabId === id) this.emitState();
        return { action: 'deny' };
      }
      if (isHttpUrl(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });

    view.webContents.on('did-start-loading', () => {
      if (this.activeTabId === id) this.emitState();
    });
    view.webContents.on('did-stop-loading', () => {
      if (this.activeTabId === id) this.emitState();
    });
    view.webContents.on('page-title-updated', () => this.emitState());
    view.webContents.on('dom-ready', () => {
      const opts = this.getAdBlockOptions();
      const host = this.getActiveHostname();
      const whitelisted = host ? isWhitelistedHost(host, opts.whitelistedHosts ?? []) : false;
      if (opts.adBlockEnabled && !whitelisted) {
        void view.webContents.insertCSS(COSMETIC_ADBLOCK_CSS).catch(() => undefined);
      }
    });
    view.webContents.on('did-navigate', () => {
      entry.blockedCount = 0;
      if (this.activeTabId === id) {
        this.sniffer.clear();
        this.emitState();
      }
    });
    view.webContents.on('did-navigate-in-page', () => {
      if (this.activeTabId === id) this.emitState();
    });

    view.webContents.on('will-navigate', (event, url) => {
      if (!isHttpUrl(url)) {
        event.preventDefault();
        return;
      }
      const opts = this.getAdBlockOptions();
      const whitelisted = opts.whitelistedHosts ?? [];
      if ((opts.adBlockEnabled || opts.popupBlockEnabled !== false) && shouldBlockUrl(url, whitelisted)) {
        event.preventDefault();
        entry.blockedCount += 1;
        if (this.activeTabId === id) this.emitState();
      }
    });

    this.switchTab(id);
    if (initialUrl && isHttpUrl(initialUrl)) {
      void view.webContents.loadURL(initialUrl);
    }
    return id;
  }

  switchTab(tabId: string): void {
    const target = this.tabs.get(tabId);
    if (!target) return;

    const current = this.getActiveTab();
    if (current && current.id !== tabId && this.isVisible) {
      this.parentWindow.removeBrowserView(current.view);
    }

    this.activeTabId = tabId;
    if (this.isVisible) {
      this.parentWindow.addBrowserView(target.view);
      if (this.lastBounds) target.view.setBounds(this.lastBounds);
    }
    this.emitState();
  }

  closeTab(tabId: string): void {
    const entry = this.tabs.get(tabId);
    if (!entry) return;
    if (this.isVisible && this.activeTabId === tabId) {
      this.parentWindow.removeBrowserView(entry.view);
    }
    this.tabs.delete(tabId);
    (entry.view.webContents as unknown as { destroy?: () => void }).destroy?.();

    if (this.tabs.size === 0) {
      this.activeTabId = undefined;
      this.createTab();
      return;
    }

    if (this.activeTabId === tabId) {
      const next = Array.from(this.tabs.keys())[0];
      if (next) this.switchTab(next);
    } else {
      this.emitState();
    }
  }

  ensureCreated(): BrowserView {
    const active = this.getActiveTab();
    if (active) return active.view;
    this.createTab();
    return this.getActiveTab()!.view;
  }

  private emitState(): void {
    const active = this.getActiveTab();
    if (!active) return;
    const wc = active.view.webContents;
    const tabs: BrowserTabInfo[] = Array.from(this.tabs.values()).map((t) => ({
      id: t.id,
      title: t.view.webContents.getTitle() || t.view.webContents.getURL() || 'Nueva pestaña',
      url: t.view.webContents.getURL(),
      isLoading: t.view.webContents.isLoading(),
    }));

    this.onNavigationStateChanged({
      url: wc.getURL(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
      isLoading: wc.isLoading(),
      blockedCount: active.blockedCount,
      activeTabId: active.id,
      tabs,
    });
  }

  setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.lastBounds = bounds;
    this.getActiveTab()?.view.setBounds(bounds);
  }

  navigate(url: string): void {
    if (!isHttpUrl(url)) throw new Error('Solo se permiten URLs http(s).');
    void this.ensureCreated().webContents.loadURL(url);
  }

  goBack(): void {
    const wc = this.getActiveTab()?.view.webContents;
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  }

  goForward(): void {
    const wc = this.getActiveTab()?.view.webContents;
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  }

  reload(): void {
    this.getActiveTab()?.view.webContents.reload();
  }

  hide(): void {
    this.isVisible = false;
    const active = this.getActiveTab();
    if (active) this.parentWindow.removeBrowserView(active.view);
  }

  show(): void {
    this.isVisible = true;
    const view = this.ensureCreated();
    this.parentWindow.addBrowserView(view);
    if (this.lastBounds) view.setBounds(this.lastBounds);
    this.emitState();
  }
}
