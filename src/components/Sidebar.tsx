import { NavLink } from 'react-router-dom';
import { Home, Compass, Download, History, Settings } from 'lucide-react';
import type { ReactNode } from 'react';

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
  return (
    <nav className="flex h-full w-56 flex-col gap-1 border-r border-border bg-surface-raised px-3 py-4">
      <div className="mb-4 px-2 text-sm font-semibold tracking-wide text-content">VidFlow</div>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            [
              'focus-ring flex items-center gap-3 rounded-card px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-content-muted hover:bg-surface-sunken hover:text-content',
            ].join(' ')
          }
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
