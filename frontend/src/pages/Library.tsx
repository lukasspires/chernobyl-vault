import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Search } from 'lucide-react';
import { api } from '../api';
import { ComicCard, ComicCardSkeleton } from '../components/ComicCard';

export function Library() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [tag, setTag] = useState('');
  const [favorite, setFavorite] = useState(false);
  const queryClient = useQueryClient();

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p.search = search;
    if (type) p.type = type;
    if (tag) p.tag = tag;
    if (favorite) p.favorite = 'true';
    return p;
  }, [search, type, tag, favorite]);

  const { data: series = [], isLoading } = useQuery({
    queryKey: ['library', params],
    queryFn: () => api.getLibrary(params),
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: api.getTags,
  });

  const scanMutation = useMutation({
    mutationFn: api.scanLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Biblioteca</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            {series.length} série{series.length !== 1 ? 's' : ''} na biblioteca
          </p>
        </div>
        <button
          type="button"
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
          {scanMutation.isPending ? 'Escaneando...' : 'Reescanear'}
        </button>
      </div>

      {scanMutation.isSuccess ? (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm">
          Scan concluído: {scanMutation.data.seriesAdded} séries e {scanMutation.data.chaptersAdded} capítulos adicionados.
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="search"
            placeholder="Buscar séries ou capítulos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <option value="">Todos os tipos</option>
          <option value="manga">Mangá</option>
          <option value="comic">Quadrinho</option>
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <option value="">Todas as tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.name}>{t.name} ({t.count})</option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer">
          <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
          Favoritos
        </label>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <ComicCardSkeleton key={i} />)}
        </div>
      ) : series.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="mb-4">Nenhuma série encontrada.</p>
          <Link to="/settings" className="text-violet-600 hover:underline">Configure os caminhos da biblioteca</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {series.map((s) => <ComicCard key={s.id} series={s} />)}
        </div>
      )}
    </div>
  );
}
