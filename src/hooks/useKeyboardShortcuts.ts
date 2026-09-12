import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts(): void {
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTyping && e.key !== ',') return;

      if (!e.ctrlKey) return;
      switch (e.key.toLowerCase()) {
        case 'l':
          e.preventDefault();
          void navigate('/');
          break;
        case ',':
          e.preventDefault();
          void navigate('/settings');
          break;
        case 'h':
          e.preventDefault();
          void navigate('/history');
          break;
        case 'j':
          e.preventDefault();
          void navigate('/downloads');
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}
