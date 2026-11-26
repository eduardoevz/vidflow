import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Download, History, Settings, ArrowDownToLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDownloadsStore } from '../stores/downloadsStore';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', icon: <Home size={18} /> },
  { to: '/browser', label: 'Navegador', icon: <Compass size={18} /> },
  { to: '/downloads', label: 'Descargas', icon: <Download size={18} /> },
  { to: '/history', label: 'Historial', icon: <History size={18} /> },
  { to: '/settings', label: 'Ajustes', icon: <Settings size={18} /> },
];

export function Sidebar(): JSX.Element {
  const { records, liveProgress, refresh, subscribe } = useDownloadsStore();

  useEffect(() => {
    void refresh();
    return subscribe();
  }, [refresh, subscribe]);

  const activeCount = records.filter((r) => {
    const status = liveProgress[String(r.id)]?.status ?? r.status;
    return status === 'queued' || status === 'analyzing' || status === 'downloading' || status === 'merging' || status === 'processing';
  }).length;

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col gap-1.5 border-r border-border bg-surface-raised px-3 py-5">
      <div className="mb-5 flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white shadow-sm">
          <ArrowDownToLine size={16} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight text-content">VidFlow</span>
          <span className="text-[11px] text-content-muted">Gestor multimedia</span>
        </div>
      </div>

      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            [
              'focus-ring flex items-center justify-between rounded-card px-3 py-2.5 text-sm transition-all duration-150',
              isActive
                ? 'bg-accent/12 font-semibold text-accent shadow-sm ring-1 ring-accent/20'
                : 'text-content-muted hover:bg-surface-sunken hover:text-content',
            ].join(' ')
          }
        >
          <span className="flex items-center gap-3">
            {item.icon}
            {item.label}
          </span>
          {item.to === '/downloads' && activeCount > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
