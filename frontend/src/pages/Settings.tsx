import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../api';
import { applyTheme, useAppStore, type ReadingDirection, type Theme } from '../store';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { theme, setTheme, readingDirection, setReadingDirection } = useAppStore();
  const [paths, setPaths] = useState<string[]>([]);
  const [newPath, setNewPath] = useState('');
  const [malClientId, setMalClientId] = useState('');
  const [comicvineKey, setComicvineKey] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  useEffect(() => {
    if (!settings) return;
    if (Array.isArray(settings.library_paths)) setPaths(settings.library_paths as string[]);
    if (typeof settings.mal_client_id === 'string') setMalClientId(settings.mal_client_id);
    if (typeof settings.comicvine_api_key === 'string') setComicvineKey(settings.comicvine_api_key);
    if (typeof settings.theme === 'string') setTheme(settings.theme as Theme);
    if (typeof settings.reading_direction === 'string') setReadingDirection(settings.reading_direction as ReadingDirection);
  }, [settings, setTheme, setReadingDirection]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const saveMutation = useMutation({
    mutationFn: () => api.saveSettings({
      library_paths: paths,
      theme,
      reading_direction: readingDirection,
      mal_client_id: malClientId,
      comicvine_api_key: comicvineKey,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-zinc-500 text-sm">Personalize biblioteca, aparência e integrações</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Caminhos da biblioteca</h2>
        <p className="text-sm text-zinc-500">Pastas com CBZ, CBR, PDF ou imagens. Ex: D:\Mangas ou /mnt/nas/comics</p>
        <div className="space-y-2">
          {paths.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input value={p} readOnly className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono text-sm" />
              <button type="button" onClick={() => setPaths(paths.filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newPath.trim()) {
              setPaths([...paths, newPath.trim()]);
              setNewPath('');
            }
          }}
        >
          <input
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="C:\Mangas ou /library"
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-sm"
          />
          <button type="submit" className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900">
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Aparência</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-zinc-500">Tema</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
              <option value="system">Sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-zinc-500">Direção de leitura</span>
            <select value={readingDirection} onChange={(e) => setReadingDirection(e.target.value as ReadingDirection)} className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
              <option value="ltr">Esquerda → Direita</option>
              <option value="rtl">Direita → Esquerda (mangá)</option>
              <option value="vertical">Vertical (rolagem contínua)</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">APIs de metadados (opcional)</h2>
        <label className="block">
          <span className="text-sm text-zinc-500">MyAnimeList Client ID</span>
          <input value={malClientId} onChange={(e) => setMalClientId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-sm" />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-500">ComicVine API Key</span>
          <input value={comicvineKey} onChange={(e) => setComicvineKey(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-sm" />
        </label>
      </section>

      <button
        type="button"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saved ? 'Salvo!' : saveMutation.isPending ? 'Salvando...' : 'Salvar configurações'}
      </button>

      <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
        <strong>Privacidade:</strong> esta aplicação não possui login. Mantenha o acesso restrito à rede local ou VPN.
      </div>
    </div>
  );
}
