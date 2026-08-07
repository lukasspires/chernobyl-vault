import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookDown, ChevronLeft, ChevronRight, ExternalLink, Globe2, LoaderCircle, Search, SlidersHorizontal, Square, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, type RemoteChapter, type RemoteManga } from '../api';

const PAGE_SIZE = 20;
const CHAPTER_PAGE_SIZE = 50;
const ACTIVE_JOBS = new Set(['queued', 'running']);

function defaultLanguages(manga: RemoteManga): string[] {
  if (manga.availableLanguages.includes('pt-br')) return ['pt-br'];
  if (manga.availableLanguages.includes('en')) return ['en'];
  return manga.availableLanguages.slice(0, 1);
}

function matchesChapter(chapter: RemoteChapter, search: string): boolean {
  const terms = search.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '').split(/\s+/).filter(Boolean);
  const value = [chapter.title, chapter.language, chapter.group, chapter.number].filter((item) => item != null).join(' ')
    .toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return terms.every((term) => value.includes(term));
}

export function ExplorePage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [status, setStatus] = useState('');
  const [demographic, setDemographic] = useState('');
  const [originalLanguage, setOriginalLanguage] = useState('');
  const [year, setYear] = useState('');
  const [order, setOrder] = useState('relevance');
  const [tag, setTag] = useState('');
  const [includeAdult, setIncludeAdult] = useState(false);
  const [readerUrl, setReaderUrl] = useState('');
  const [selectedManga, setSelectedManga] = useState<RemoteManga | null>(null);
  const [htmlChapters, setHtmlChapters] = useState<RemoteChapter[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [chapterPage, setChapterPage] = useState(1);
  const [chapterSearch, setChapterSearch] = useState('');
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const [dataSaver, setDataSaver] = useState(false);

  const searchParams = useMemo(() => {
    const params: Record<string, string> = { q: submittedQuery, limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE), order };
    if (status) params.statuses = status;
    if (demographic) params.demographics = demographic;
    if (originalLanguage) params.originalLanguages = originalLanguage;
    if (year) params.year = year;
    if (tag) params.tags = tag;
    params.contentRatings = includeAdult ? 'safe,suggestive,erotica,pornographic' : 'safe,suggestive,erotica';
    return params;
  }, [submittedQuery, page, order, status, demographic, originalLanguage, year, tag, includeAdult]);

  const catalog = useQuery({ queryKey: ['remote-manga', searchParams], queryFn: () => api.searchRemoteManga(searchParams), enabled: !selectedManga });
  const tags = useQuery({ queryKey: ['remote-tags'], queryFn: api.getRemoteTags, enabled: showFilters && !selectedManga, staleTime: 60 * 60_000 });
  const chaptersQuery = useQuery({
    queryKey: ['remote-chapters', selectedManga?.sourceId, languages, chapterPage],
    queryFn: () => api.getRemoteChapters(selectedManga!.sourceId, languages, chapterPage, CHAPTER_PAGE_SIZE),
    enabled: selectedManga?.source === 'mangadex' && languages.length > 0,
  });
  const jobs = useQuery({
    queryKey: ['scraper-downloads'], queryFn: api.getDownloads,
    refetchInterval: (queryState) => (queryState.state.data?.some((job) => ACTIVE_JOBS.has(job.status)) ? 1_000 : 5_000),
  });

  const analyze = useMutation({
    mutationFn: api.analyzeRemoteUrl,
    onSuccess: ({ manga, chapters }) => {
      setSelectedManga(manga); setHtmlChapters(chapters); setLanguages([]); setChapterPage(1); setSelectedChapterIds(new Set());
    },
  });
  const download = useMutation({
    mutationFn: ({ manga, chapters }: { manga: RemoteManga; chapters: RemoteChapter[] }) => api.startDownload(manga, chapters, dataSaver),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['scraper-downloads'] }); setSelectedChapterIds(new Set()); },
  });
  const cancel = useMutation({ mutationFn: api.cancelDownload, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scraper-downloads'] }) });

  useEffect(() => {
    if (jobs.data?.some((job) => job.status === 'completed')) {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    }
  }, [jobs.data, queryClient]);

  const chapters = selectedManga?.source === 'html' ? htmlChapters : (chaptersQuery.data?.chapters ?? []);
  const visibleChapters = chapters.filter((chapter) => matchesChapter(chapter, chapterSearch));
  const selectedChapters = chapters.filter((chapter) => selectedChapterIds.has(chapter.sourceId));
  const totalCatalogPages = Math.max(1, Math.ceil((catalog.data?.total ?? 0) / PAGE_SIZE));
  const totalChapterPages = Math.max(1, Math.ceil((chaptersQuery.data?.total ?? htmlChapters.length) / CHAPTER_PAGE_SIZE));

  const chooseManga = (manga: RemoteManga) => {
    setSelectedManga(manga); setLanguages(defaultLanguages(manga)); setHtmlChapters([]); setChapterPage(1); setChapterSearch(''); setSelectedChapterIds(new Set());
  };
  const closeManga = () => { setSelectedManga(null); setHtmlChapters([]); setSelectedChapterIds(new Set()); };
  const toggleLanguage = (language: string) => {
    setLanguages((current) => current.includes(language) ? current.filter((item) => item !== language) : [...current, language]);
    setChapterPage(1); setSelectedChapterIds(new Set());
  };
  const toggleChapter = (id: string) => setSelectedChapterIds((current) => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const selectVisible = (checked: boolean) => setSelectedChapterIds((current) => {
    const next = new Set(current); for (const chapter of visibleChapters) checked ? next.add(chapter.sourceId) : next.delete(chapter.sourceId); return next;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Explorar e baixar</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Pesquise no MangaDex ou importe de um leitor HTML compatível.</p>
        </div>
        <a href="https://mangadex.org" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-violet-600 hover:underline">
          Catálogo MangaDex <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {!selectedManga ? (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <form onSubmit={(event) => { event.preventDefault(); setSubmittedQuery(query.trim()); setPage(1); }} className="flex flex-col gap-3 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Pesquisar obras</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar mangá por título..." className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-4 dark:border-zinc-700 dark:bg-zinc-950" />
              </label>
              <button type="submit" className="rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-700">Pesquisar</button>
              <button type="button" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters} className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 dark:border-zinc-700"><SlidersHorizontal className="h-4 w-4" /> Filtros</button>
            </form>
            {showFilters ? (
              <div className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800">
                <label className="text-sm">Ordenar<select value={order} onChange={(e) => { setOrder(e.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950"><option value="relevance">Relevância</option><option value="followedCount">Mais seguidos</option><option value="latestUploadedChapter">Atualizados recentemente</option><option value="title">Título</option><option value="year">Ano</option></select></label>
                <label className="text-sm">Status<select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950"><option value="">Todos</option><option value="ongoing">Em publicação</option><option value="completed">Concluído</option><option value="hiatus">Hiato</option><option value="cancelled">Cancelado</option></select></label>
                <label className="text-sm">Demografia<select value={demographic} onChange={(e) => { setDemographic(e.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950"><option value="">Todas</option><option value="shounen">Shounen</option><option value="shoujo">Shoujo</option><option value="seinen">Seinen</option><option value="josei">Josei</option></select></label>
                <label className="text-sm">Idioma original<input value={originalLanguage} onChange={(e) => { setOriginalLanguage(e.target.value.trim().toLowerCase()); setPage(1); }} placeholder="Ex.: ja, ko, zh" maxLength={10} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950" /></label>
                <label className="text-sm">Ano<input type="number" min="1900" max={new Date().getFullYear() + 1} value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950" /></label>
                <label className="text-sm sm:col-span-2">Tag<select value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950"><option value="">Todas</option>{tags.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="flex items-center gap-2 self-end rounded-lg border border-zinc-200 p-2 text-sm dark:border-zinc-700"><input type="checkbox" checked={includeAdult} onChange={(e) => { setIncludeAdult(e.target.checked); setPage(1); }} /> Incluir conteúdo pornográfico</label>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <form onSubmit={(event) => { event.preventDefault(); if (readerUrl.trim()) analyze.mutate(readerUrl.trim()); }} className="flex flex-col gap-3 sm:flex-row">
              <label className="relative flex-1"><span className="sr-only">URL do leitor</span><Globe2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /><input type="url" required value={readerUrl} onChange={(e) => setReaderUrl(e.target.value)} placeholder="URL de uma obra ou capítulo em leitor HTML/Madara" className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-4 dark:border-zinc-700 dark:bg-zinc-950" /></label>
              <button type="submit" disabled={analyze.isPending} className="rounded-lg border border-violet-300 px-4 py-2 text-violet-700 disabled:opacity-50 dark:border-violet-800 dark:text-violet-300">{analyze.isPending ? 'Analisando...' : 'Analisar URL'}</button>
            </form>
            {analyze.isError ? <p role="alert" className="mt-3 text-sm text-red-600">{analyze.error.message}</p> : null}
          </section>

          {catalog.isError ? <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-950 dark:text-red-300">{catalog.error.message}</div> : catalog.isLoading ? <div className="py-16 text-center text-zinc-500"><LoaderCircle className="mx-auto mb-2 h-6 w-6 animate-spin" /> Carregando catálogo...</div> : catalog.data?.items.length === 0 ? <div className="py-16 text-center text-zinc-500">Nenhuma obra encontrada.</div> : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {catalog.data?.items.map((manga) => <button type="button" key={manga.sourceId} onClick={() => chooseManga(manga)} className="card-hover overflow-hidden rounded-xl border border-zinc-200 bg-white text-left dark:border-zinc-800 dark:bg-zinc-900"><div className="aspect-[2/3] bg-zinc-100 dark:bg-zinc-800">{manga.thumbnailUrl ? <img src={manga.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-zinc-400">Sem capa</div>}</div><div className="p-3"><h2 className="line-clamp-2 font-medium">{manga.title}</h2><p className="mt-1 text-xs text-zinc-500">{[manga.year, manga.status].filter(Boolean).join(' · ') || 'MangaDex'}</p></div></button>)}
            </div>
          )}
          <div className="flex items-center justify-center gap-3"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Página anterior" className="rounded-lg border p-2 disabled:opacity-40 dark:border-zinc-700"><ChevronLeft className="h-4 w-4" /></button><span className="text-sm">Página {page} de {totalCatalogPages}</span><button type="button" disabled={page >= totalCatalogPages} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página" className="rounded-lg border p-2 disabled:opacity-40 dark:border-zinc-700"><ChevronRight className="h-4 w-4" /></button></div>
        </>
      ) : (
        <section className="space-y-6">
          <button type="button" onClick={closeManga} className="inline-flex items-center gap-1 text-sm text-violet-600 hover:underline"><ChevronLeft className="h-4 w-4" /> Voltar ao catálogo</button>
          <div className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            {selectedManga.thumbnailUrl ? <img src={selectedManga.thumbnailUrl} alt="" className="h-36 w-24 rounded-lg object-cover" /> : null}
            <div className="min-w-0 flex-1"><h2 className="text-xl font-bold">{selectedManga.title}</h2><p className="mt-1 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">{selectedManga.description || 'Sem descrição disponível.'}</p>{selectedManga.authors.length ? <p className="mt-2 text-sm"><strong>Autores:</strong> {selectedManga.authors.join(', ')}</p> : null}<a href={selectedManga.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-violet-600 hover:underline">Abrir fonte <ExternalLink className="h-3.5 w-3.5" /></a></div>
          </div>
          {selectedManga.source === 'mangadex' ? <div><h3 className="mb-2 font-semibold">Idiomas dos capítulos</h3><div className="flex flex-wrap gap-2">{selectedManga.availableLanguages.map((language) => <label key={language} className="flex cursor-pointer items-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700"><input type="checkbox" checked={languages.includes(language)} onChange={() => toggleLanguage(language)} /> {language}</label>)}</div>{languages.length === 0 ? <p className="mt-2 text-sm text-amber-600">Selecione pelo menos um idioma.</p> : null}</div> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="relative flex-1"><span className="sr-only">Filtrar capítulos</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /><input type="search" value={chapterSearch} onChange={(e) => setChapterSearch(e.target.value)} placeholder="Filtrar por número, título, idioma ou grupo..." className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-4 dark:border-zinc-700 dark:bg-zinc-900" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={visibleChapters.length > 0 && visibleChapters.every((chapter) => selectedChapterIds.has(chapter.sourceId))} onChange={(e) => selectVisible(e.target.checked)} /> Selecionar página</label></div>
          {chaptersQuery.isLoading ? <div className="py-12 text-center text-zinc-500">Carregando capítulos...</div> : chaptersQuery.isError ? <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-950 dark:text-red-300">{chaptersQuery.error.message}</div> : visibleChapters.length === 0 ? <div className="py-12 text-center text-zinc-500">Nenhum capítulo encontrado.</div> : <div className="max-h-[32rem] divide-y divide-zinc-200 overflow-y-auto rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">{visibleChapters.map((chapter) => <label key={chapter.sourceId} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"><input type="checkbox" checked={selectedChapterIds.has(chapter.sourceId)} onChange={() => toggleChapter(chapter.sourceId)} className="mt-1" /><span className="min-w-0"><span className="block text-sm font-medium">{chapter.title}</span>{chapter.group ? <span className="block text-xs text-zinc-500">{chapter.language} · {chapter.group}</span> : null}</span></label>)}</div>}
          {selectedManga.source === 'mangadex' && totalChapterPages > 1 ? <div className="flex items-center justify-center gap-3"><button type="button" disabled={chapterPage <= 1} onClick={() => { setChapterPage((value) => value - 1); setSelectedChapterIds(new Set()); }} aria-label="Página anterior de capítulos" className="rounded-lg border p-2 disabled:opacity-40 dark:border-zinc-700"><ChevronLeft className="h-4 w-4" /></button><span className="text-sm">Página {chapterPage} de {totalChapterPages}</span><button type="button" disabled={chapterPage >= totalChapterPages} onClick={() => { setChapterPage((value) => value + 1); setSelectedChapterIds(new Set()); }} aria-label="Próxima página de capítulos" className="rounded-lg border p-2 disabled:opacity-40 dark:border-zinc-700"><ChevronRight className="h-4 w-4" /></button></div> : null}
          <div className="sticky bottom-3 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-900/95"><div><strong>{selectedChapterIds.size}</strong> capítulo(s) selecionado(s)<label className="ml-4 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={dataSaver} onChange={(e) => setDataSaver(e.target.checked)} disabled={selectedManga.source !== 'mangadex'} /> Economia de dados</label></div><button type="button" disabled={selectedChapters.length === 0 || download.isPending} onClick={() => download.mutate({ manga: selectedManga, chapters: selectedChapters })} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-white disabled:opacity-50"><BookDown className="h-4 w-4" /> {download.isPending ? 'Iniciando...' : 'Baixar e adicionar à biblioteca'}</button></div>
          {download.isError ? <p role="alert" className="text-sm text-red-600">{download.error.message}</p> : null}
        </section>
      )}

      <section className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Downloads</h2>
        {jobs.isLoading ? <p className="text-sm text-zinc-500">Carregando downloads...</p> : jobs.data?.length === 0 ? <p className="text-sm text-zinc-500">Nenhum download iniciado nesta execução.</p> : <div className="space-y-3">{jobs.data?.map((job) => {
          const progress = job.totalPages ? Math.round((job.currentPage / job.totalPages) * 100) : 0;
          return <article key={job.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">{job.manga.title}</h3><p className="text-xs text-zinc-500">{job.status === 'running' ? `${job.currentChapter ?? 'Preparando'} · ${job.completedChapters}/${job.chapterCount} capítulos` : job.status === 'completed' ? `Concluído · ${job.completedChapters} capítulo(s)` : job.status === 'failed' ? 'Falhou' : job.status === 'cancelled' ? 'Cancelado' : 'Na fila'}</p></div>{ACTIVE_JOBS.has(job.status) ? <button type="button" onClick={() => cancel.mutate(job.id)} aria-label={`Cancelar download de ${job.manga.title}`} className="rounded-lg border border-zinc-200 p-2 text-red-600 dark:border-zinc-700"><Square className="h-4 w-4" /></button> : <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">{job.downloadedPages} novas · {job.skippedPages} retomadas</span>}</div>{job.status === 'running' ? <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"><div className="h-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} /></div> : null}{job.errors.length ? <details className="mt-3 text-sm text-red-600"><summary>{job.errors.length} erro(s)</summary><ul className="mt-1 space-y-1">{job.errors.map((item, index) => <li key={`${item.chapter}-${index}`}>{item.chapter}: {item.error}</li>)}</ul></details> : null}</article>;
        })}</div>}
      </section>
      <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300"><X className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Baixe somente conteúdo que você tem autorização para usar. O leitor não contorna login, CAPTCHA, paywall ou DRM.</p>
    </div>
  );
}
