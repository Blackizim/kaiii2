import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CURATED_CATALOG, type EpisodeItem, type MediaTitle } from './data/curatedCatalog';
import { CatalogGridView } from './components/CatalogGridView';
import { CinemaPlayer } from './components/CinemaPlayer';
import { HeroSpotlight } from './components/HeroSpotlight';
import { HomeBrowseView, type WatchProgressEntry } from './components/HomeBrowseView';
import { AccountMenu } from './components/AccountMenu';
import {
  AccountModal,
  readAccounts,
  updateStoredAccount,
  type Account,
  type Profile,
} from './components/AccountModal';
import { VipModal } from './components/VipModal';
import { allowedForProfile } from './utils/profileRating';
import { isAccountVip } from './utils/vipHelpers';
import { SearchModal } from './components/SearchModal';
import { SettingsModal } from './components/SettingsModal';
import { TitleInfoView } from './components/TitleInfoView';
import { TopNav, type NavSection } from './components/TopNav';
import {
  DEFAULT_VAELOR_SETTINGS,
  type AnonymizedExtractResponse,
  type VaelorSettings,
} from './types/player';

const STORAGE_MYLIST = 'vaelor_mylist_v1';
const STORAGE_WATCHED = 'vaelor_watched_v1';
const STORAGE_CONTINUE = 'vaelor_continue_v1';
const STORAGE_SETTINGS = 'vaelor_settings_v1';

function readStorageJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [fullCatalog, setCatalog] = useState<MediaTitle[]>(CURATED_CATALOG);
  const [activeSection, setActiveSection] = useState<NavSection>('home');

  // Selected Title -> Info View (triggers automatic background extraction)
  const [selectedTitle, setSelectedTitle] = useState<MediaTitle | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);

  // Player modal state
  const [playerActive, setPlayerActive] = useState(false);
  const [playerStreamIndex, setPlayerStreamIndex] = useState(0);
  const [playerResumeAtSec, setPlayerResumeAtSec] = useState(0);

  // Progressive automatic extraction state
  const [extractState, setExtractState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: AnonymizedExtractResponse | null;
    error?: string;
  }>({ status: 'idle', data: null });
  const extractAbortRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Modals
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);
  const [accountAction, setAccountAction] = useState<{ edit?: Profile; add?: boolean; manage?: boolean }>({});
  const [account, setAccount] = useState<Account | null>(() => { const session = readStorageJson<{email: string}>('kairou_session_v1', { email: '' }); return readAccounts().find(a => a.email === session.email) || null; });
  const [profile, setProfile] = useState<Profile | null>(() => { const session = readStorageJson<{email: string; profileId: string}>('kairou_session_v1', { email: '', profileId: '' }); return readAccounts().find(a => a.email === session.email)?.profiles.find(p => p.id === session.profileId) || null; });
  const isVip = isAccountVip(account);
  const catalog = useMemo(() => fullCatalog.filter(item => allowedForProfile(item, profile?.maxRating, profile?.kids)), [fullCatalog, profile]);
  const storageKey = (key: string, a = account, p = profile) => a && p ? `${key}:${encodeURIComponent(a.email)}:${p.id}` : key;
  const selectProfile = (next: Profile, current = account) => {
    if (!current) return;
    setProfile(next);
    localStorage.setItem('kairou_session_v1', JSON.stringify({ email: current.email, profileId: next.id }));
    setMyListIds(readStorageJson(storageKey(STORAGE_MYLIST, current, next), []));
    setWatchedIds(readStorageJson(storageKey(STORAGE_WATCHED, current, next), []));
    setContinueWatching(readStorageJson(storageKey(STORAGE_CONTINUE, current, next), []));
    setSelectedTitle(null); setActiveSection('home');
  };
  const logout = () => { localStorage.removeItem('kairou_session_v1'); setAccount(null); setProfile(null); setMyListIds(readStorageJson(STORAGE_MYLIST, [])); setWatchedIds(readStorageJson(STORAGE_WATCHED, [])); setContinueWatching(readStorageJson(STORAGE_CONTINUE, [])); setSelectedTitle(null); setAccountOpen(false); };

  // Persisted user state
  const [myListIds, setMyListIds] = useState<string[]>(() => readStorageJson(storageKey(STORAGE_MYLIST), []));
  const [watchedIds, setWatchedIds] = useState<string[]>(() => readStorageJson(storageKey(STORAGE_WATCHED), []));
  const [continueWatching, setContinueWatching] = useState<WatchProgressEntry[]>(() =>
    readStorageJson(storageKey(STORAGE_CONTINUE), [])
  );
  const [settings, setSettings] = useState<VaelorSettings>(() =>
    readStorageJson(STORAGE_SETTINGS, DEFAULT_VAELOR_SETTINGS)
  );

  // Fetch live TMDB PT-BR catalog on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/catalog')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { items?: MediaTitle[] } | null) => {
        if (!cancelled && json?.items && json.items.length > 0) {
          setCatalog(json.items);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup SSE/Abort on unmount
  useEffect(() => {
    return () => {
      extractAbortRef.current?.abort();
      eventSourceRef.current?.close();
    };
  }, []);

  // Cmd/Ctrl + K opens Search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !target?.isContentEditable && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '')) {
        e.preventDefault();
        setSearchOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const updateSettings = (next: VaelorSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const toggleMyList = (item: MediaTitle) => {
    setMyListIds((prev) => {
      const exists = prev.includes(item.id);
      const next = exists ? prev.filter((id) => id !== item.id) : [item.id, ...prev];
      try {
        localStorage.setItem(storageKey(STORAGE_MYLIST), JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleWatched = (id: string) => {
    setWatchedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      try {
        localStorage.setItem(storageKey(STORAGE_WATCHED), JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const removeContinueItem = (id: string) => {
    setContinueWatching((prev) => {
      const next = prev.filter((e) => e.item.id !== id);
      try {
        localStorage.setItem(storageKey(STORAGE_CONTINUE), JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const saveContinueProgress = useCallback(
    (item: MediaTitle, currentTime: number, duration: number, s?: number, e?: number) => {
      if (!Number.isFinite(currentTime) || currentTime < 3) return;
      setContinueWatching((prev) => {
        const filtered = prev.filter((entry) => entry.item.id !== item.id);
        const updated: WatchProgressEntry = {
          item,
          currentTime,
          duration,
          season: s,
          episode: e,
          updatedAt: Date.now(),
        };
        const next = [updated, ...filtered].slice(0, 12);
        try {
          localStorage.setItem(storageKey(STORAGE_CONTINUE), JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [account, profile]
  );

  const applyPreferenceOrder = useCallback(
    (snapshot: AnonymizedExtractResponse): AnonymizedExtractResponse => {
      const streams = [...(snapshot.streams ?? [])];
      if (!settings.preferPtBr) {
        streams.sort((a, b) => Number(a.isPtBr) - Number(b.isPtBr));
      }
      return { ...snapshot, streams };
    },
    [settings.preferPtBr]
  );

  // Progressive SSE stream preparation when selecting any title or episode
  const runAutoExtraction = useCallback(
    async (item: MediaTitle, s: number, e: number, refresh = false) => {
      extractAbortRef.current?.abort();
      eventSourceRef.current?.close();
      eventSourceRef.current = null;

      const controller = new AbortController();
      extractAbortRef.current = controller;

      const tmdb = item.tmdbId || '';
      if (!tmdb) {
        setExtractState({
          status: 'error',
          data: null,
          error: 'Identificador indisponível para este título.',
        });
        return;
      }

      const target = item.mediaType === 'series' ? `${tmdb}/${s}/${e}` : tmdb;

      setExtractState((prev) => ({
        status: 'loading',
        data: refresh ? prev.data : null,
      }));

      try {
        const isAnimeHint =
          item.network === 'Crunchyroll' ||
          item.genres.some((g) => /anima/i.test(g));
        const res = await fetch('/api/extract/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target,
            imdbId: item.imdbId,
            title: item.title,
            originalTitle: item.originalTitle,
            isAnime: isAnimeHint,
            refresh,
          }),
          signal: controller.signal,
        });
        const startJson = (await res.json()) as {
          jobId: string | null;
          done: boolean;
          snapshot: AnonymizedExtractResponse;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(startJson.error || `Erro HTTP ${res.status}`);
        }
        if (controller.signal.aborted) return;

        if (startJson.done || !startJson.jobId) {
          setExtractState({
            status: 'ready',
            data: applyPreferenceOrder(startJson.snapshot),
          });
          return;
        }

        if (startJson.snapshot.streams.length > 0) {
          setExtractState({
            status: 'loading',
            data: applyPreferenceOrder(startJson.snapshot),
          });
        }

        const es = new EventSource(`/api/extract/stream/${encodeURIComponent(startJson.jobId)}`);
        eventSourceRef.current = es;

        es.onmessage = (ev) => {
          try {
            const payload = JSON.parse(ev.data) as {
              done: boolean;
              snapshot: AnonymizedExtractResponse | null;
            };
            if (payload.snapshot) {
              setExtractState({
                status: payload.done ? 'ready' : 'loading',
                data: applyPreferenceOrder(payload.snapshot),
              });
            } else if (payload.done) {
              setExtractState((curr) => ({ ...curr, status: 'ready' }));
            }
            if (payload.done) {
              es.close();
              if (eventSourceRef.current === es) eventSourceRef.current = null;
            }
          } catch {
            // ignore parse error
          }
        };

        es.onerror = () => {
          es.close();
          if (eventSourceRef.current === es) eventSourceRef.current = null;
          setExtractState((curr) => ({
            ...curr,
            status: curr.data?.streams?.length ? 'ready' : 'error',
          }));
        };
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setExtractState({
          status: 'error',
          data: null,
          error: err instanceof Error ? err.message : 'Indisponível no momento.',
        });
      }
    },
    [applyPreferenceOrder]
  );

  // Open Title Info View (always routes to Info Page first and prepares playback in parallel!)
  const openTitleInfo = useCallback(
    async (rawItem: MediaTitle, resume = false) => {
      const existingProgress = continueWatching.find((c) => c.item.id === rawItem.id);
      const initSeason = existingProgress?.season ?? rawItem.defaultSeason ?? 1;
      const initEpisode = existingProgress?.episode ?? rawItem.defaultEpisode ?? 1;

      setSelectedTitle(rawItem);
      setSelectedSeason(initSeason);
      setSelectedEpisode(initEpisode);
      setPlayerActive(false);
      setPlayerResumeAtSec(resume && existingProgress ? existingProgress.currentTime : 0);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Start preparing streams immediately
      if (rawItem.tmdbId) {
        void runAutoExtraction(rawItem, initSeason, initEpisode, false);
      }

      // Fetch rich TMDB PT-BR details (logo PNG, cast photos, imdbId, episodes)
      setIsLoadingMeta(true);
      try {
        const lookupId = rawItem.tmdbId || rawItem.imdbId || rawItem.id;
        const metaRes = await fetch(
          `/api/title/${rawItem.mediaType}/${encodeURIComponent(lookupId)}`
        );
        if (metaRes.ok) {
          const metaJson = (await metaRes.json()) as { item?: MediaTitle };
          if (metaJson.item) {
            const enriched = metaJson.item;
            setSelectedTitle((curr) =>
              curr?.id === rawItem.id
                ? { ...enriched, rankToday: curr.rankToday ?? enriched.rankToday }
                : curr
            );
            if (!rawItem.tmdbId && enriched.tmdbId) {
              void runAutoExtraction(enriched, initSeason, initEpisode, false);
            }
          }
        }
      } catch {
        // keep current item
      } finally {
        setIsLoadingMeta(false);
      }
    },
    [continueWatching, runAutoExtraction]
  );

  const handleSelectSeasonEpisode = async (s: number, e: number, autoLaunch = false) => {
    setSelectedSeason(s);
    setSelectedEpisode(e);
    setPlayerResumeAtSec(0);
    if (!selectedTitle) return;

    void runAutoExtraction(selectedTitle, s, e, false);
    if (autoLaunch) {
      setPlayerStreamIndex(0);
      setPlayerActive(true);
    }

    // Fetch real PT-BR episodes for chosen season if not loaded yet
    const hasSeasonEps = (selectedTitle.episodes ?? []).some((ep) => ep.season === s);
    if (!hasSeasonEps && selectedTitle.tmdbId) {
      setIsLoadingMeta(true);
      try {
        const res = await fetch(
          `/api/title/series/${encodeURIComponent(selectedTitle.tmdbId)}/season/${s}`
        );
        if (res.ok) {
          const json = (await res.json()) as { episodes?: EpisodeItem[] };
          if (json.episodes && json.episodes.length > 0) {
            setSelectedTitle((curr) => {
              if (!curr) return curr;
              const existing = curr.episodes ?? [];
              const merged = [...existing.filter((x) => x.season !== s), ...json.episodes!];
              return { ...curr, episodes: merged };
            });
          }
        }
      } catch {
        // ignore
      } finally {
        setIsLoadingMeta(false);
      }
    }
  };

  const myListItems = catalog.filter((item) => myListIds.includes(item.id));

  return (
    <div className="min-h-screen bg-[#08090C] text-stone-100 antialiased">
      {!playerActive && (
        <TopNav
          activeSection={activeSection}
          showBack={Boolean(selectedTitle)}
          onBack={() => {
            setSelectedTitle(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onSelectSection={(sec) => {
            setSelectedTitle(null);
            setActiveSection(sec);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenAccount={() => { if (account && profile) setAccountMenuOpen(v => !v); else { setAccountAction({}); setAccountOpen(true); } }}
          profile={profile}
          isVip={isVip}
        />
      )}

      {selectedTitle ? (
        <TitleInfoView
          item={selectedTitle}
          isLoadingMeta={isLoadingMeta}
          selectedSeason={selectedSeason}
          selectedEpisode={selectedEpisode}
          extractState={extractState}
          inMyList={myListIds.includes(selectedTitle.id)}
          isWatched={watchedIds.includes(selectedTitle.id)}
          onSelectSeasonEpisode={(s, e, autoLaunch) =>
            void handleSelectSeasonEpisode(s, e, autoLaunch)
          }
          onRefreshExtract={() =>
            void runAutoExtraction(selectedTitle, selectedSeason, selectedEpisode, true)
          }
          onLaunchPlayer={(idx = 0) => {
            setPlayerStreamIndex(idx);
            setPlayerActive(true);
          }}
          onToggleMyList={() => toggleMyList(selectedTitle)}
          onToggleWatched={() => toggleWatched(selectedTitle.id)}
        />
      ) : activeSection === 'home' ? (
        <>
          <HeroSpotlight
            items={catalog}
            myListIds={myListIds}
            onOpenInfo={(item) => void openTitleInfo(item)}
            onToggleMyList={toggleMyList}
          />
          <HomeBrowseView
            catalog={catalog}
            continueWatching={continueWatching.filter(entry => allowedForProfile(entry.item, profile?.maxRating, profile?.kids))}
            myListIds={myListIds}
            onOpenInfo={(item, resume) => void openTitleInfo(item, resume)}
            onRemoveContinue={removeContinueItem}
          />
        </>
      ) : activeSection === 'movies' ? (
        <CatalogGridView
          title="Filmes"
          subtitle="Destaques em cinema, 4K UHD e lançamentos dublados em PT-BR."
          items={catalog}
          mediaTypeFilter="movie"
          onOpenInfo={(item) => void openTitleInfo(item)}
        />
      ) : activeSection === 'shows' ? (
        <CatalogGridView
          title="Séries"
          subtitle="Temporadas completas com áudio PT-BR, original e legendas sincronizadas."
          items={catalog}
          mediaTypeFilter="series"
          onOpenInfo={(item) => void openTitleInfo(item)}
        />
      ) : (
        <CatalogGridView
          title="Minha Lista"
          subtitle="Seus filmes e séries salvos para assistir quando quiser."
          items={myListItems}
          mediaTypeFilter="all"
          emptyMessage="Sua lista ainda está vazia. Clique no botão + em qualquer título para salvá-lo aqui."
          onOpenInfo={(item) => void openTitleInfo(item)}
        />
      )}

      {playerActive && selectedTitle && (
        <CinemaPlayer
          key={`${selectedTitle.id}-s${selectedSeason}-e${selectedEpisode}`}
          item={selectedTitle}
          season={selectedTitle.mediaType === 'series' ? selectedSeason : undefined}
          episode={selectedTitle.mediaType === 'series' ? selectedEpisode : undefined}
          streams={extractState.data?.streams ?? []}
          subtitles={extractState.data?.subtitles ?? []}
          isPreparing={extractState.status === 'loading'}
          initialStreamIndex={playerStreamIndex}
          resumeAtSec={playerResumeAtSec}
          defaultSubtitlesOn={settings.defaultSubtitlesOn}
          autoplayNextEpisode={settings.autoplayNextEpisode}
          subtitleStyle={settings.subtitleStyle}
          onUpdateSubtitleStyle={(nextStyle) =>
            updateSettings({ ...settings, subtitleStyle: nextStyle })
          }
          onProgress={(ct, dur) =>
            saveContinueProgress(
              selectedTitle,
              ct,
              dur,
              selectedTitle.mediaType === 'series' ? selectedSeason : undefined,
              selectedTitle.mediaType === 'series' ? selectedEpisode : undefined
            )
          }
          onPlayNextEpisode={(nextS, nextE) => {
            void handleSelectSeasonEpisode(nextS, nextE, true);
          }}
          onRefreshStreams={() =>
            void runAutoExtraction(selectedTitle, selectedSeason, selectedEpisode, true)
          }
          onBack={() => setPlayerActive(false)}
        />
      )}

      <SearchModal
        isOpen={searchOpen}
        catalog={catalog}
        maxRating={profile?.maxRating}
        kids={profile?.kids}
        onClose={() => setSearchOpen(false)}
        onSelectTitle={(item) => void openTitleInfo(item)}
      />

      {account && profile && (
        <AccountMenu
          isOpen={accountMenuOpen}
          account={account}
          profile={profile}
          isVip={isVip}
          onClose={() => setAccountMenuOpen(false)}
          onSelect={(p) => {
            selectProfile(p);
            setAccountMenuOpen(false);
          }}
          onEdit={(p) => {
            setAccountAction({ edit: p });
            setAccountMenuOpen(false);
            setAccountOpen(true);
          }}
          onManage={() => {
            setAccountAction({ manage: true });
            setAccountMenuOpen(false);
            setAccountOpen(true);
          }}
          onAdd={() => {
            setAccountAction({ add: true });
            setAccountMenuOpen(false);
            setAccountOpen(true);
          }}
          onOpenVip={() => {
            setAccountMenuOpen(false);
            setVipOpen(true);
          }}
          onLogout={() => {
            setAccountMenuOpen(false);
            logout();
          }}
        />
      )}
      {accountOpen && (
        <AccountModal
          initialEdit={accountAction.edit}
          initialAdd={accountAction.add}
          initialManage={accountAction.manage}
          account={account}
          profile={profile}
          onClose={() => setAccountOpen(false)}
          onOpenVip={() => setVipOpen(true)}
          onAccount={(next) => {
            setAccount(next);
            if (!account) {
              localStorage.setItem('kairou_session_v1', JSON.stringify({ email: next.email, profileId: '' }));
              setProfile(null);
              setMyListIds([]);
              setWatchedIds([]);
              setContinueWatching([]);
            } else if (profile) {
              setProfile(next.profiles.find((p) => p.id === profile.id) || profile);
            }
          }}
          onProfile={selectProfile}
          onLogout={logout}
        />
      )}
      {vipOpen && account && (
        <VipModal
          account={account}
          onUpdateAccount={(updated) => {
            const saved = updateStoredAccount(updated);
            setAccount(saved);
          }}
          onClose={() => setVipOpen(false)}
        />
      )}
      <SettingsModal
        isOpen={settingsOpen}
        settings={settings}
        onUpdateSettings={updateSettings}
        onClearHistory={() => {
          setContinueWatching([]);
          try {
            localStorage.removeItem(storageKey(STORAGE_CONTINUE));
          } catch {
            // ignore
          }
        }}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
