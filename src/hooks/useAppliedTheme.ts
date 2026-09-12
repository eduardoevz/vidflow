import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useAppliedTheme(): void {
  const theme = useSettingsStore((s) => s.settings.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);
}
