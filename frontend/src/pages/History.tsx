import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { api } from '../api';

export function HistoryPage() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: api.getHistory,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6" /> Histórico
        </h1>
        <p className="text-zinc-500 text-sm">Últimos 50 capítulos lidos</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 skeleton" />)}
        </div>
      ) : history.length === 0 ? (
        <p className="text-zinc-500 text-center py-12">Nenhum histórico ainda. Comece a ler!</p>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <Link
              key={entry.id}
              to={`/read/${entry.chapter_id}`}
              className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <div>
                <p className="font-medium">{entry.series_title}</p>
                <p className="text-sm text-zinc-500">{entry.chapter_title} · Página {entry.page + 1}/{entry.page_count}</p>
              </div>
              <time className="text-xs text-zinc-400">
                {new Date(entry.read_at).toLocaleString('pt-BR')}
              </time>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
