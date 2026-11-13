import React, { useState } from 'react';
import { ArrowUp, ChevronRight, Pencil, Play, Star, Trash2 } from 'lucide-react';
import type { MediaTitle } from '../data/curatedCatalog';
import { useScrollReveal } from '../utils/useScrollReveal';
import { formatRemainingMinutes } from '../utils/streamLogic';

export interface WatchProgressEntry {
  item: MediaTitle;
  currentTime: number;
  duration: number;
  season?: number;
  episode?: number;
  updatedAt: number;
}

interface HomeBrowseViewProps {
  catalog: MediaTitle[];
  continueWatching: WatchProgressEntry[];
  myListIds: string[];
  onOpenInfo: (item: MediaTitle, resume?: boolean) => void;
  onRemoveContinue: (id: string) => void;
}

export const HomeBrowseView: React.FC<HomeBrowseViewProps> = ({
  catalog,
  continueWatching,
  onOpenInfo,
  onRemoveContinue,
}) => {
  const [editContinue, setEditContinue] = useState(false);
  const [failedImg, setFailedImg] = useState<Record<string, boolean>>({});

  const revealRef = useScrollReveal<HTMLDivElement>([catalog, continueWatching]);
  const top10 = catalog.slice(0, 10);
  const trendingNow = catalog.slice(0, 20);
  const seriesItems = catalog.filter((i) => i.mediaType === 'series');
  const movieItems = catalog.filter((i) => i.mediaType === 'movie');
  const actionSciFi = catalog.filter((i) =>
    i.genres.some((g) => /ação|ficção|aventura/i.test(g))
  );

  return (
    <div ref={revealRef} className="w-full px-5 sm:px-10 pb-20 pt-8 space-y-12">
      {/* Continue Watching Rail */}
      {continueWatching.length > 0 && (
        <section aria-labelledby="continue-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="continue-heading"
              className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-1.5"
            >
              Continuar Assistindo
              <ChevronRight className="w-4 h-4 text-stone-400" strokeWidth={1.75} />
            </h2>
            <button
              type="button"
              onClick={() => setEditContinue((v) => !v)}
              aria-label="Editar lista de continuar assistindo"
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                editContinue
                  ? 'bg-white text-stone-950'
                  : 'text-stone-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Pencil className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto overflow-y-visible overscroll-x-contain pb-2 no-scrollbar">
            {continueWatching.map((entry) => {
              const pct =
                entry.duration > 0
                  ? Math.min(98, Math.max(4, Math.round((entry.currentTime / entry.duration) * 100)))
                  : 18;
              const imgSrc = failedImg[`cw-${entry.item.id}`]
                ? '/src/assets/images/cinelume_hero_cinema_1794566229858.jpg'
                : entry.item.backdrop;

              return (
                <article
                  key={entry.item.id}
                  className="group relative w-[270px] sm:w-[300px] shrink-0 space-y-2"
                >
                  <button
                    type="button"
                    onClick={() => onOpenInfo(entry.item, true)}
                    className="relative block w-full aspect-video rounded-xl overflow-hidden bg-stone-900 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <img
                      src={imgSrc}
                      alt={entry.item.title}
                      referrerPolicy="no-referrer"
                      onError={() => setFailedImg((p) => ({ ...p, [`cw-${entry.item.id}`]: true }))}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-80" />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="w-11 h-11 rounded-full bg-white text-stone-950 flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 fill-current ml-0.5" strokeWidth={1.75} />
                      </span>
                    </span>
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-white/25">
                      <div className="h-full bg-white" style={{ width: `${pct}%` }} />
                    </div>
                  </button>

                  {editContinue && (
                    <button
                      type="button"
                      onClick={() => onRemoveContinue(entry.item.id)}
                      aria-label={`Remover ${entry.item.title} do histórico`}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/80 text-white hover:bg-red-600 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  )}

                  <div className="px-0.5">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {entry.item.title}
                      {entry.season && entry.episode ? ` · T${entry.season}E${entry.episode}` : ''}
                    </h3>
                    <p className="text-xs text-stone-400 tabular-nums">
                      {formatRemainingMinutes(
                        entry.duration || entry.item.runtimeMinutes * 60,
                        entry.currentTime
                      )}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Top 10 Today with Giant Hollow Outlined Numbers */}
      <section aria-labelledby="top10-heading" className="space-y-5">
        <h2 id="top10-heading" className="font-display text-lg sm:text-xl font-bold text-white">
          Top 10 hoje no Kairou
        </h2>

        <div className="flex gap-6 sm:gap-8 overflow-x-auto overflow-y-visible overscroll-x-contain pb-4 pl-2 no-scrollbar">
          {top10.map((item, idx) => {
            const rank = idx + 1;
            const posterSrc = failedImg[`t10-${item.id}`]
              ? '/src/assets/images/poster_nyc_winter_1794566231280.jpg'
              : item.poster;

            return (
              <button
                key={item.id}
                data-scroll-reveal
                type="button"
                onClick={() => onOpenInfo(item)}
                className="group relative flex items-end shrink-0 pl-9 sm:pl-12 cursor-pointer focus-visible:outline-2 focus-visible:outline-white rounded-xl"
                aria-label={`#${rank} ${item.title}`}
              >
                <span
                  aria-hidden="true"
                  className="rank-outline absolute left-0 bottom-0 text-[105px] sm:text-[132px] pointer-events-none transition-transform duration-200 group-hover:scale-105"
                >
                  {rank}
                </span>
                <div className="relative z-10 w-[142px] sm:w-[190px] xl:w-[208px] aspect-[2/3] rounded-xl overflow-hidden bg-stone-900 border border-white/10 shadow-xl transition-transform duration-200 group-hover:-translate-y-1">
                  <img
                    src={posterSrc}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    onError={() => setFailedImg((p) => ({ ...p, [`t10-${item.id}`]: true }))}
                    className="w-full h-full object-cover"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Live TMDB Em Alta Agora Rail */}
      <section aria-labelledby="trending-heading" className="space-y-4">
        <h2 id="trending-heading" className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-1.5">
          Em Alta Agora
          <ChevronRight className="w-4 h-4 text-stone-400" strokeWidth={1.75} />
        </h2>
        <PosterRail items={trendingNow} failedImg={failedImg} setFailedImg={setFailedImg} onOpenInfo={onOpenInfo} />
      </section>

      {/* Series Rail */}
      <section aria-labelledby="series-heading" className="space-y-4">
        <h2 id="series-heading" className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-1.5">
          Séries em Alta
          <ChevronRight className="w-4 h-4 text-stone-400" strokeWidth={1.75} />
        </h2>
        <PosterRail items={seriesItems} failedImg={failedImg} setFailedImg={setFailedImg} onOpenInfo={onOpenInfo} />
      </section>

      {/* Filmes Populares Rail */}
      <section aria-labelledby="movies-heading" className="space-y-4">
        <h2 id="movies-heading" className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-1.5">
          Filmes Populares
          <ChevronRight className="w-4 h-4 text-stone-400" strokeWidth={1.75} />
        </h2>
        <PosterRail items={movieItems} failedImg={failedImg} setFailedImg={setFailedImg} onOpenInfo={onOpenInfo} />
      </section>

      {/* Action & Sci-Fi Rail */}
      <section aria-labelledby="scifi-heading" className="space-y-4">
        <h2 id="scifi-heading" className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-1.5">
          Ação &amp; Ficção Científica
          <ChevronRight className="w-4 h-4 text-stone-400" strokeWidth={1.75} />
        </h2>
        <PosterRail items={actionSciFi} failedImg={failedImg} setFailedImg={setFailedImg} onOpenInfo={onOpenInfo} />
      </section>

      {/* Floating scroll-to-top button */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Voltar ao topo"
        className="fixed bottom-6 right-6 z-30 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all duration-150 cursor-pointer"
      >
        <ArrowUp className="w-4 h-4" strokeWidth={1.75} />
      </button>
    </div>
  );
};

interface PosterRailProps {
  items: MediaTitle[];
  failedImg: Record<string, boolean>;
  setFailedImg: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onOpenInfo: (item: MediaTitle) => void;
}

const PosterRail: React.FC<PosterRailProps> = ({
  items,
  failedImg,
  setFailedImg,
  onOpenInfo,
}) => {
  return (
    <div className="flex gap-4 overflow-x-auto overflow-y-visible overscroll-x-contain pb-2 no-scrollbar">
      {items.map((item) => {
        const posterSrc = failedImg[`rail-${item.id}`]
          ? '/src/assets/images/poster_metro_hospital_1794566232848.jpg'
          : item.poster;

        return (
          <button
            key={item.id}
            data-scroll-reveal
            type="button"
            onClick={() => onOpenInfo(item)}
            className="group w-[148px] sm:w-[190px] xl:w-[208px] shrink-0 text-left space-y-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-white rounded-xl"
          >
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-stone-900 border border-white/10 transition-transform duration-200 group-hover:-translate-y-1">
              <img
                src={posterSrc}
                alt={item.title}
                referrerPolicy="no-referrer"
                onError={() => setFailedImg((p) => ({ ...p, [`rail-${item.id}`]: true }))}
                className="w-full h-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3">
                <span className="inline-flex items-center gap-1 text-[11px] font-display font-medium tracking-wide text-white/95">
                  {item.qualityBadge} · {item.rating}{' '}
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" strokeWidth={1.75} />
                </span>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-medium text-stone-200 group-hover:text-white truncate">
              {item.title}
            </p>
          </button>
        );
      })}
    </div>
  );
};
