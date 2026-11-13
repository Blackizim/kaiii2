export interface AnimeCandidateEntry {
  url: string;
  title: string;
}

export interface EpisodeLinkEntry {
  url: string;
  text: string;
  episodeNumber?: number;
}

const NOISE_WORDS = new Set([
  'dublado',
  'legendado',
  'todos',
  'os',
  'episodios',
  'episodio',
  'online',
  'assistir',
  'gratis',
  'hd',
  'fhd',
  '4k',
  'anime',
  'animes',
  'completo',
  'temporada',
  'season',
]);

const STOP_WORDS = new Set(['the', 'no', 'na', 'ni', 'wa', 'wo', 'ga', 'de', 'to', 'of', 'in', 'a', 'o', 'e', 'part', 'cour']);

export function normalizeAnimeText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&[#a-z0-9]+;/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenizeAnimeTitle(raw: string, stripNoise = true): string[] {
  const norm = normalizeAnimeText(raw);
  if (!norm) return [];
  return norm.split(/\s+/).filter((t) => {
    if (!t) return false;
    if (stripNoise && NOISE_WORDS.has(t)) return false;
    return true;
  });
}

export function detectTitleAudioKind(rawTitle: string): 'dublado' | 'legendado' | 'unknown' {
  const norm = normalizeAnimeText(rawTitle);
  if (/\bdublado\b|\bdub\b|\bpt br\b/.test(norm)) return 'dublado';
  if (/\blegendado\b|\bleg\b|\bsub\b/.test(norm)) return 'legendado';
  return 'unknown';
}

export function isMovieOrSpinOffTitle(rawTitle: string): boolean {
  const norm = normalizeAnimeText(rawTitle);
  return /\b(filme|movie|ova|ona|especial|special|chuugakkou|chibi|summary|recap)\b/.test(norm);
}

/**
 * Extracts explicit season number from an anime title when the base query title itself
 * doesn't already end in that number.
 */
export function extractSeasonHint(rawTitle: string, baseQueryTitles: string[] = []): number | null {
  const norm = normalizeAnimeText(rawTitle)
    .replace(/\b(dublado|legendado|todos os episodios|online|assistir|hd|pt br)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const baseNorms = baseQueryTitles.map((q) => normalizeAnimeText(q));

  const explicit =
    norm.match(/\btemporada\s*(\d{1,2})\b/) ||
    norm.match(/\b(\d{1,2})\s*(?:a|o)?\s*temporada\b/) ||
    norm.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*season\b/) ||
    norm.match(/\bseason\s*(\d{1,2})\b/);
  if (explicit) return Number(explicit[1]);

  if (/\bfinal\s*season\b|\bkanketsu\s*hen\b/.test(norm)) return 4;

  const romanTrailing = norm.match(/\b(ii|iii|iv|v)\s*$/);
  if (romanTrailing) {
    const map: Record<string, number> = { ii: 2, iii: 3, iv: 4, v: 5 };
    return map[romanTrailing[1]] ?? null;
  }

  // Check trailing number or number right before "dublado"/"legendado" (already stripped above)
  const numTrailing = norm.match(/\b([2-9]|1[0-9])$/);
  if (numTrailing) {
    const n = numTrailing[1];
    const queryAlreadyHasNum = baseNorms.some((b) => new RegExp(`\\b${n}$`).test(b));
    if (!queryAlreadyHasNum) return Number(n);
  }

  return null;
}

/**
 * Scores how well a site search result matches the requested anime title + season.
 * Returns -1 if it should be rejected.
 */
export function scoreAnimeCandidate(
  candidateTitle: string,
  queryTitles: string[],
  targetSeason: number,
  mediaType: 'movie' | 'series' = 'series'
): number {
  if (!candidateTitle || queryTitles.length === 0) return -1;
  const isMovieTitle = isMovieOrSpinOffTitle(candidateTitle);
  if (mediaType === 'series' && isMovieTitle) return -1;
  if (mediaType === 'movie' && !isMovieTitle) {
    // Still allow if title matches strongly, just don't boost
  }

  const candTokens = tokenizeAnimeTitle(candidateTitle, true).filter((t) => !STOP_WORDS.has(t));
  if (candTokens.length === 0) return -1;

  let bestOverlapScore = -1;

  for (const q of queryTitles) {
    const qTokens = tokenizeAnimeTitle(q, true).filter((t) => !STOP_WORDS.has(t));
    if (qTokens.length === 0) continue;

    // Require every meaningful query token (excluding single-char or numbers if season>1) to match
    // or at least >= 75% overlap with >= 2 tokens when title is long
    const candSet = new Set(candTokens);
    const matched = qTokens.filter((t) => candSet.has(t));
    const recall = matched.length / qTokens.length;
    const precision = matched.length / candTokens.length;

    // Strict guard against false positives like "Shingeki no Bahamut" matching "Shingeki no Kyojin"
    if (qTokens.length >= 2 && recall < 0.75) continue;
    if (qTokens.length === 1 && recall < 1) continue;

    // Penalize candidates with lots of extra non-season words (e.g. spin-offs / movies)
    const extraNonSeasonTokens = candTokens.filter(
      (t) => !qTokens.includes(t) && !/^(2|3|4|5|ii|iii|iv|final|season|temporada|part|parte)$/.test(t)
    );
    if (extraNonSeasonTokens.length > 2 && precision < 0.5) continue;

    let score = recall * 100 + precision * 40 - extraNonSeasonTokens.length * 12;

    const candSeason = extractSeasonHint(candidateTitle, queryTitles);
    if (targetSeason === 1) {
      if (candSeason !== null && candSeason > 1) {
        score -= 90; // Strongly reject Season 2/3/4 when Season 1 is requested
      } else {
        score += 30;
      }
    } else {
      if (candSeason === targetSeason) {
        score += 55;
      } else if (candSeason !== null && candSeason !== targetSeason) {
        score -= 80;
      } else {
        // Season 1 / unnumbered series might still contain all episodes (absolute numbering)
        score -= 10;
      }
    }

    if (score > bestOverlapScore) {
      bestOverlapScore = score;
    }
  }

  return bestOverlapScore;
}

export function pickTopAnimeCandidates<T extends AnimeCandidateEntry>(
  candidates: T[],
  queryTitles: string[],
  targetSeason: number,
  mediaType: 'movie' | 'series' = 'series',
  limitPerAudio = 1
): Array<T & { audioKind: 'dublado' | 'legendado' | 'unknown'; matchScore: number }> {
  const scored = candidates
    .map((c) => ({
      ...c,
      audioKind: detectTitleAudioKind(c.title),
      matchScore: scoreAnimeCandidate(c.title, queryTitles, targetSeason, mediaType),
    }))
    .filter((c) => c.matchScore >= 60)
    .sort((a, b) => b.matchScore - a.matchScore);

  const dubs = scored.filter((c) => c.audioKind === 'dublado').slice(0, limitPerAudio);
  const subs = scored.filter((c) => c.audioKind !== 'dublado').slice(0, limitPerAudio);

  // Deduplicate by URL while preserving both dubbed and subbed picks
  const out: typeof scored = [];
  const seen = new Set<string>();
  for (const item of [...dubs, ...subs]) {
    if (!seen.has(item.url)) {
      seen.add(item.url);
      out.push(item);
    }
  }
  return out;
}

export function extractEpisodeNumberFromEntry(text: string, url: string): number | null {
  const textMatch =
    text.match(/epis[oó]dio\s*[-:#]?\s*0*(\d{1,4})\b/i) ||
    text.match(/\bep\.?\s*0*(\d{1,4})\b/i) ||
    text.match(/\b(\d{1,4})\s*$/);
  if (textMatch) return Number(textMatch[1]);

  const urlMatch =
    url.match(/episodio-(\d{1,4})\/?$/i) ||
    url.match(/[-_](\d{1,4})\/?$/i);
  if (urlMatch) return Number(urlMatch[1]);

  return null;
}

export function matchExactEpisode<T extends EpisodeLinkEntry>(
  entries: T[],
  targetEpisode: number,
  absoluteEpisode?: number,
  requireAbsoluteOnly = false
): T | null {
  const candidatesToCheck: number[] = [];
  if (!requireAbsoluteOnly) {
    candidatesToCheck.push(targetEpisode);
  }
  if (absoluteEpisode && absoluteEpisode > 0 && !candidatesToCheck.includes(absoluteEpisode)) {
    candidatesToCheck.push(absoluteEpisode);
  }

  for (const epNum of candidatesToCheck) {
    for (const entry of entries) {
      const n = entry.episodeNumber ?? extractEpisodeNumberFromEntry(entry.text, entry.url);
      if (n === epNum) return entry;
    }
  }
  return null;
}

/**
 * Decodes Anroll's DooPlay player `source` query param into a Blogger video.g URL.
 * Anroll encodes tokens by reversing the Blogger token string and base64-encoding it.
 */
export function decodeAnrollBloggerSource(embedUrl: string): string | null {
  try {
    const parsed = new URL(embedUrl);
    const rawSource = parsed.searchParams.get('source')?.trim();
    if (!rawSource) return null;
    if (/^https?:\/\//i.test(rawSource)) {
      return rawSource;
    }
    const base64 = rawSource.replace(/ /g, '+');
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    if (!decoded) return null;
    if (/^https?:\/\//i.test(decoded)) return decoded;
    const reversed = decoded.split('').reverse().join('');
    if (!reversed || reversed.length < 12) return null;
    return `https://www.blogger.com/video.g?token=${encodeURIComponent(reversed)}`;
  } catch {
    return null;
  }
}

/**
 * Extracts direct HLS `.m3u8` URLs embedded inside `api.anivideo.net/videohls.php?d=<url>`
 * iframes or scripts on AnimesDigital and AniTube episode pages.
 */
export function extractAnivideoM3u8Urls(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const regex = /https?:\/\/api\.anivideo\.net\/videohls\.php\?[^"'<>\s]+/gi;
  for (const m of html.matchAll(regex)) {
    try {
      const cleaned = m[0].replace(/&amp;/g, '&');
      const u = new URL(cleaned);
      const d = u.searchParams.get('d');
      if (d && /^https?:\/\//i.test(d) && !seen.has(d)) {
        seen.add(d);
        urls.push(d);
      }
    } catch {
      // ignore invalid URL
    }
  }
  return urls;
}

/**
 * Extracts direct Googlevideo MP4 playback URLs from a Blogger `video.g` HTML page.
 * Returns highest resolution first (e.g., itag=22 720p before itag=18 360p).
 */
export function extractBloggerMp4Urls(html: string): Array<{ url: string; quality: string }> {
  const out: Array<{ url: string; quality: string; rank: number }> = [];
  const seen = new Set<string>();
  const regex = /&quot;(https:\/\/[^&]+googlevideo\.com\/videoplayback[^&]+)&quot;/g;
  for (const m of html.matchAll(regex)) {
    const raw = m[1].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
    if (!raw.startsWith('https://') || seen.has(raw)) continue;
    seen.add(raw);
    const itag = raw.match(/[?&]itag=(\d+)/)?.[1];
    // Skip UMP / audio-only / unsupported streams; keep standard MP4 itags (22=720p, 18=360p, 37=1080p)
    const quality = itag === '37' ? '1080p Full HD' : itag === '22' ? '720p HD' : itag === '18' ? '360p' : 'HD';
    const rank = itag === '37' ? 3 : itag === '22' ? 2 : itag === '18' ? 1 : 0;
    out.push({ url: raw, quality, rank });
  }
  return out
    .sort((a, b) => b.rank - a.rank)
    .map(({ url, quality }) => ({ url, quality }));
}
