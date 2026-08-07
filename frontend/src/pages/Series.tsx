import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Heart, Play, Search, Tag } from 'lucide-react';
import { api, type MetadataResult } from '../api';
import { TagBadge } from '../components/TagBadge';

export function SeriesPage() {
  const { id } = useParams<{ id: string }>();
  const seriesId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tagInput, setTagInput] = useState('');
  const [metaQuery, setMetaQuery] = useState('');
  const [metaResults, setMetaResults] = useState<MetadataResult[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);

  const { data: series, isLoading } = useQuery({
    queryKey: ['series', seriesId],
    queryFn: () => api.getSeries(seriesId),
    enabled: !Number.isNaN(seriesId),
  });

  const favoriteMutation = useMutation({
    mutationFn: () => api.toggleFavorite(seriesId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series', seriesId] }),
  });

  const addTagMutation = useMutation({
    mutationFn: (name: string) => api.addTag(seriesId, name),
    onSuccess: () => {
      setTagInput('');
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: number) => api.removeTag(seriesId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series', seriesId] }),
  });

  const completeMutation = useMutation({
    mutationFn: (chapterId: number) => api.completeChapter(chapterId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series', seriesId] }),
  });

  const searchMetadata = async () => {
    if (!metaQuery.trim() || !series) return;
    setMetaLoading(true);
    try {
      const source = series.type === 'comic' ? 'comicvine' : 'mal';
      const results = await api.searchMetadata(metaQuery, source);
      setMetaResults(results);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro na busca');
    } finally {
      setMetaLoading(false);
    }
  };

  const applyMetadata = async (result: MetadataResult) => {
    if (!series) return;
    const source = series.type === 'comic' ? 'comicvine' : 'mal';
    try {
      await api.applyMetadata(seriesId, source, result.id);
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      setMetaResults([]);
      setMetaQuery('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao aplicar metadados');
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><div className="h-8 skeleton w-1/3" /><div className="h-64 skeleton" /></div>;
  }

  if (!series) {
    return <p>Série não encontrada. <Link to="/" className="text-amber-700 dark:text-amber-400">Voltar</Link></p>;
  }

  const continueChapter = series.chapters.find((c) => c.progress_page != null && c.progress_page < c.page_count - 1)
    ?? series.chapters.find((c) => c.progress_page != null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        <img
          src={api.coverUrl(series.id)}
          alt={series.title}
          className="w-48 rounded-xl shadow-lg object-cover aspect-[2/3]"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{series.title}</h1>
              <p className="text-zinc-500 capitalize">{series.type} · {series.chapters.length} capítulos</p>
            </div>
            <button
              type="button"
              onClick={() => favoriteMutation.mutate()}
              className={`p-2 rounded-lg border ${series.is_favorite ? 'border-red-300 text-red-500 bg-red-50 dark:bg-red-950' : 'border-zinc-200 dark:border-zinc-700'}`}
            >
              <Heart className={`w-5 h-5 ${series.is_favorite ? 'fill-current' : ''}`} />
            </button>
          </div>

          {series.description ? (
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed whitespace-pre-line">{series.description}</p>
          ) : null}

          {continueChapter ? (
            <button
              type="button"
              onClick={() => navigate(`/read/${continueChapter.id}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400"
            >
              <Play className="w-4 h-4" />
              Continuar — {continueChapter.title} (p. {(continueChapter.progress_page ?? 0) + 1})
            </button>
          ) : null}

          <div className="flex flex-wrap gap-2 items-center">
            <Tag className="w-4 h-4 text-zinc-400" />
            {series.tags.map((t) => (
              <TagBadge key={t.id} name={t.name} onRemove={() => removeTagMutation.mutate(t.id)} />
            ))}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (tagInput.trim()) addTagMutation.mutate(tagInput.trim());
              }}
            >
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Nova tag..."
                className="px-2 py-1 text-sm rounded border border-zinc-200 dark:border-zinc-700 bg-transparent"
              />
            </form>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3">
            <h3 className="font-medium flex items-center gap-2"><Search className="w-4 h-4" /> Buscar metadados</h3>
            <div className="flex gap-2">
              <input
                value={metaQuery}
                onChange={(e) => setMetaQuery(e.target.value)}
                placeholder="Título para buscar..."
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
              />
              <button type="button" onClick={searchMetadata} disabled={metaLoading} className="px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm">
                {metaLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            {metaResults.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-auto">
                {metaResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => applyMetadata(r)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-left"
                  >
                    {r.imageUrl ? <img src={r.imageUrl} alt="" className="w-10 h-14 object-cover rounded" /> : null}
                    <span className="text-sm font-medium">{r.title}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Capítulos</h2>
        <div className="grid gap-2">
          {series.chapters.map((ch) => (
            <div
              key={ch.id}
              className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <button type="button" onClick={() => navigate(`/read/${ch.id}`)} className="flex-1 text-left">
                <span className="font-medium">{ch.title}</span>
                <span className="text-sm text-zinc-500 ml-2">{ch.page_count} págs · {ch.format.toUpperCase()}</span>
                {ch.progress_page != null ? (
                  <span className="text-sm text-amber-700 dark:text-amber-400 ml-2">Página {ch.progress_page + 1}</span>
                ) : null}
              </button>
              <div className="flex gap-2">
                {ch.is_read ? <Check className="w-4 h-4 text-green-500" /> : null}
                <button
                  type="button"
                  onClick={() => completeMutation.mutate(ch.id)}
                  className="text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Marcar lido
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
