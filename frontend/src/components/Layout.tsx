import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Clock, Compass, Library, Settings } from 'lucide-react';
import { applyTheme, useAppStore } from '../store';

const nav = [
  { to: '/', label: 'Biblioteca', icon: Library },
  { to: '/explore', label: 'Explorar', icon: Compass },
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
      <header className="sticky top-0 z-40 border-b border-amber-200/80 bg-white/85 backdrop-blur dark:border-amber-900/60 dark:bg-zinc-950/90">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="group flex items-center gap-2" aria-label="Chernobyl Vault — início">
            <img src="/brand-mark.svg" alt="" className="h-9 w-9 transition-transform group-hover:rotate-6" />
            <span className="leading-tight">
              <span className="block text-base font-bold tracking-wide text-zinc-950 dark:text-amber-100">Chernobyl Vault</span>
              <span className="hidden text-[0.65rem] uppercase tracking-[0.2em] text-amber-700 sm:block dark:text-amber-400">Stories from the Exclusion Zone</span>
            </span>
          </Link>
          <nav className="flex gap-1" aria-label="Navegação principal">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  location.pathname === to
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
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
      <footer className="border-t border-zinc-200 px-4 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <a
          href="https://github.com/lukasspires/chernobyl-vault"
          target="_blank"
          rel="noreferrer"
          className="text-amber-700 hover:underline dark:text-amber-400"
        >
          Código-fonte
        </a>
        {' · '}Chernobyl Vault é distribuído sob AGPL-3.0.
      </footer>
    </div>
  );
}
