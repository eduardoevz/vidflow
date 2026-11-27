import { useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from './Layout';
import { CloseConfirmation } from './CloseConfirmation';
import { useAppliedTheme } from '../hooks/useAppliedTheme';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSettingsStore } from '../stores/settingsStore';
import { HomePage } from '../features/home/HomePage';
import { BrowserPage } from '../features/browser/BrowserPage';
import { DownloadsPage } from '../features/downloads/DownloadsPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { SubscriptionsPage } from '../features/subscriptions/SubscriptionsPage';
import { SettingsPage } from '../features/settings/SettingsPage';

function ThemedApp(): JSX.Element {
  const navigate = useNavigate();
  useAppliedTheme();
  useKeyboardShortcuts();

  useEffect(() => {
    return window.vidflow.onExtensionMediaCaptured((item) => {
      void navigate('/', { state: { analyzeUrl: item.url, referer: item.referer ?? item.pageUrl } });
    });
  }, [navigate]);

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="browser" element={<BrowserPage />} />
          <Route path="downloads" element={<DownloadsPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <CloseConfirmation />
    </>
  );
}

export function App(): JSX.Element {
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return (
    <HashRouter>
      <ThemedApp />
    </HashRouter>
  );
}
