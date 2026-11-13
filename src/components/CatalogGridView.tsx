import React, { useMemo, useState } from 'react';
import { BookmarkX, Film, Play, Star, Tv } from 'lucide-react';
import type { MediaTitle } from '../data/curatedCatalog';
import { useScrollReveal } from '../utils/useScrollReveal';
import { filterCatalogTitles } from '../utils/streamLogic';

interface CatalogGridViewProps {
  title: string;
  subtitle: string;
  items: MediaTitle[];
  mediaTypeFilter: 'all' | 'movie' | 'series';
  emptyMessage?: string;
  onOpenInfo: (item: MediaTitle) => void;
}

export const CatalogGridView: React.FC<CatalogGridViewProps> = ({
  title,
  subtitle,
  items,
  mediaTypeFilter,
  emptyMessage = 'Nenhum título disponível nesta seleção.',
  onOpenInfo,
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [failedImg, setFailedImg] = useState<Record<string, boolean>>({});

  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (mediaTypeFilter !== 'all' && item.mediaType !== mediaTypeFilter) continue;
      for (const g of item.genres) {
        counts.set(g, (counts.get(g) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([g]) => g);
  }, [items, mediaTypeFilter]);

  const filtered = useMemo(
    () =>
      filterCatalogTitles(items, {
        mediaType: mediaTypeFilter,
        genre: selectedGenre,
      }),
    [items, mediaTypeFilter, selectedGenre]
  );

  const revealRef = useScrollReveal<HTMLElement>([filtered]);

  return (
    <main ref={revealRef} className="mx-auto max-w-[1440px] px-5 sm:px-10 pt-28 pb-20 space-y-8 animate-vaelor-enter">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-display font-medium uppercase tracking-wider text-stone-400">
            {mediaTypeFilter === 'movie' ? (
              <Film className="w-3.5 h-3.5" />
            ) : mediaTypeFilter === 'series' ? (
              <Tv className="w-3.5 h-3.5" />
            ) : null}
            <span>{filtered.length} títulos disponíveis</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {title}
          </h1>
          <p className="text-sm text-stone-400">{subtitle}</p>
        </div>

        {/* Genre Filters */}
        {genres.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => setSelectedGenre(null)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedGenre === null
                  ? 'bg-white text-stone-950 font-semibold'
                  : 'bg-white/8 text-stone-300 hover:bg-white/15 hover:text-white'
              }`}
            >
              Todos
            </button>
            {genres.map((genre) => {
              const active = selectedGenre === genre;
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setSelectedGenre(active ? null : genre)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-white text-stone-950 font-semibold'
                      : 'bg-white/8 text-stone-300 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center space-y-3 border border-white/10 rounded-2xl bg-white/[0.02]">
          <BookmarkX className="w-10 h-10 text-stone-500 mx-auto" />
          <p className="text-sm text-stone-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filtered.map((item) => {
            const posterSrc = failedImg[item.id]
              ? '/src/assets/images/poster_nyc_winter_1794566231280.jpg'
              : item.poster;

            return (
              <button
                key={item.id}
                data-scroll-reveal
                type="button"
                onClick={() => onOpenInfo(item)}
                className="group text-left space-y-2.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-white rounded-xl"
              >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-stone-900 border border-white/10 transition-transform duration-200 group-hover:-translate-y-1">
                  <img
                    src={posterSrc}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    onError={() => setFailedImg((p) => ({ ...p, [item.id]: true }))}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3">
                    <span className="self-end text-[11px] font-display font-medium tracking-wide text-white bg-black/65 px-2 py-0.5 rounded-md">
                      {item.qualityBadge}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="w-9 h-9 rounded-full bg-white text-stone-950 flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </span>
                      <span className="text-xs font-semibold text-white">Ver Detalhes</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-stone-100 group-hover:text-white truncate">
                    {item.title}
                  </h2>
                  <p className="inline-flex items-center gap-1 text-xs text-stone-400 tabular-nums">
                    <span>{item.year}</span>
                    <span>·</span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" strokeWidth={1.75} />
                    <span>{item.rating}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
};
