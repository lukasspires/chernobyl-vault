import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Clock, Library, Settings } from 'lucide-react';
import { applyTheme, useAppStore } from '../store';

const nav = [
  { to: '/', label: 'Biblioteca', icon: Library },
  { to: '/history', label: 'Histórico', icon: Clock },
  { to: '/settings', label: 'Configurações', icon: Settings },
];

export function Layout() {
  const location = useLocation();
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  const isReader = location.pathname.startsWith('/read/');

  if (isReader) return <Outlet />;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
            <BookOpen className="w-6 h-6 text-violet-600" />
            Manga Reader
          </Link>
          <nav className="flex gap-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  location.pathname === to
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
