import { Link } from 'react-router-dom';
import { Heart, Play } from 'lucide-react';
import { api, type Series } from '../api';

interface Props {
  series: Series;
}

export function ComicCard({ series }: Props) {
  const hasProgress = series.last_chapter_id != null && series.last_page != null;

  return (
    <Link
      to={`/series/${series.id}`}
      className="group card-hover block rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm"
    >
      <div className="relative aspect-[2/3] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <img
          src={api.coverUrl(series.id)}
          alt={series.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect fill="%23e4e4e7" width="200" height="300"/><text x="100" y="150" text-anchor="middle" fill="%2371717a" font-size="14">${series.title.slice(0, 20)}</text></svg>`,
            );
          }}
        />
        {series.is_favorite ? (
          <span className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-red-400">
            <Heart className="w-4 h-4 fill-current" />
          </span>
        ) : null}
        {hasProgress ? (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500 text-zinc-950 text-xs font-medium">
            <Play className="w-3 h-3" /> Continuar
          </span>
        ) : null}
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium bg-black/50 text-white capitalize">
          {series.type}
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-medium truncate group-hover:text-amber-700 dark:group-hover:text-amber-400">
          {series.title}
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {series.chapter_count} capítulo{series.chapter_count !== 1 ? 's' : ''}
        </p>
      </div>
    </Link>
  );
}

export function ComicCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
      <div className="aspect-[2/3] skeleton" />
      <div className="p-3 space-y-2">
        <div className="h-4 skeleton w-3/4" />
        <div className="h-3 skeleton w-1/2" />
      </div>
    </div>
  );
}
