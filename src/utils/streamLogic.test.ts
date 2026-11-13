import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyVideoDimensions,
  convertSrtToVtt,
  detectMp4CodecFromBytes,
  detectStreamFormat,
  filterCatalogTitles,
  findActiveSkipSegment,
  formatClock,
  formatRemainingMinutes,
  inferStreamFormatFromUrlOrMeta,
  isLikelyHevcStream,
  isUltraHdQuality,
  parseAniSkipResponse,
  parseH264SpsFromSegmentBytes,
  parseHlsMasterMaxDimensions,
  parseMp4TkhdDimensions,
  parseTheIntroDbV2Response,
  parseTmdbTarget,
  resolveNextEpisode,
  rewriteHlsManifestWithResolver,
  shouldShowNextEpisodeCard,
  sortBrowserCompatibleFirst,
} from './streamLogic';

const FORBIDDEN_SOURCE_TERMS = [
  'brflix',
  'rivo',
  'seuseriado',
  'playerflix',
  'embedplayer2',
  'watchplay',
  'hclod',
  'vidbolt',
  'hakunaymatata',
  'pomfy',
  'streamverde',
  'byse',
  'superflix',
  'warezcdn',
  'myembed',
  'cinesrc',
  'fmhy',
  'abyssplayer',
  'embedplayabyss',
  'rousav',
  'bright67',
  'veyra',
  'kingvod',
  'fenixflix',
  'fenixhub',
  'bestcine',
  'zeus-br',
  'zeus',
  'horcrux',
  'hls.lol',
  'pleiades',
  'popplay',
  'superstream',
  'meowtv',
  'zunderflix',
  'framex',
  'p-stream',
  'brazuca',
  'watchug',
  'animesfhd',
  'animesdigital',
  'anitube',
  'anroll',
  'anivideo',
  'dattebayo',
  'goyabu',
  'hinatasoul',
  'animeyabu',
  'animefire',
  'animesonline',
  'animesice',
  'shardweb',
  'baby-beamup',
];

function containsForbiddenSourceNames(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_SOURCE_TERMS.some((term) => lower.includes(term));
}

test('parseTmdbTarget parses movie IDs, series episode targets, and direct URLs', () => {
  assert.deepEqual(parseTmdbTarget('772'), { kind: 'movie', tmdbId: '772' });
  assert.deepEqual(parseTmdbTarget('62650/12/2'), {
    kind: 'tv',
    tmdbId: '62650',
    season: 12,
    episode: 2,
  });
  assert.deepEqual(parseTmdbTarget('66732 T1E1'), {
    kind: 'tv',
    tmdbId: '66732',
    season: 1,
    episode: 1,
  });
  assert.equal(parseTmdbTarget('https://cdn.example.com/master.m3u8').kind, 'direct');
  assert.equal(parseTmdbTarget('').kind, 'invalid');
});

test('detectStreamFormat identifies #EXTM3U HLS and ftyp MP4 signatures', () => {
  const hlsBytes = new TextEncoder().encode('#EXTM3U\n#EXT-X-VERSION:3\n');
  assert.deepEqual(detectStreamFormat('application/vnd.apple.mpegurl', hlsBytes), {
    formato: 'hls',
    manifesto: true,
    ftyp: false,
    confirmada: true,
  });

  const mp4Bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  assert.deepEqual(detectStreamFormat('video/mp4', mp4Bytes), {
    formato: 'mp4',
    manifesto: false,
    ftyp: true,
    confirmada: true,
  });
});

test('rewriteHlsManifestWithResolver rewrites segments and URI attributes using opaque tokens', () => {
  const raw = [
    '#EXTM3U',
    '#EXT-X-MAP:URI="init.mp4"',
    '0000.js',
    'https://upstream.secret.invalid/seg2.ts',
  ].join('\n');

  let count = 0;
  const rewritten = rewriteHlsManifestWithResolver(
    raw,
    'https://upstream.secret.invalid/v01/playlist.m3u8',
    () => `/api/p/tok_${++count}`
  );

  assert.match(rewritten, /URI="\/api\/p\/tok_1"/);
  assert.match(rewritten, /\n\/api\/p\/tok_2\n/);
  assert.match(rewritten, /\n\/api\/p\/tok_3$/);
  assert.equal(rewritten.includes('upstream.secret.invalid'), false);
});

test('convertSrtToVtt converts SRT cue commas to WebVTT dots', () => {
  const srt = '1\n00:01:02,340 --> 00:01:05,120\nOlá, mundo!\n';
  const vtt = convertSrtToVtt(srt);
  assert.equal(vtt.startsWith('WEBVTT\n\n'), true);
  assert.match(vtt, /00:01:02\.340 --> 00:01:05\.120/);
  assert.match(vtt, /Olá, mundo!/);
});

test('sortBrowserCompatibleFirst prioritizes PT-BR H.264 1080p ahead of 720p, optional 4K, and HEVC', () => {
  const input = [
    { id: 'hevc', formato: 'hls', codec: 'h265' as const, idioma: 'en-us', qualidade: '1080p' },
    { id: 'en-h264', formato: 'hls', codec: 'h264' as const, idioma: 'en-us', qualidade: '1080p' },
    { id: 'pt-4k', formato: 'hls', codec: 'h264' as const, idioma: 'pt-br', qualidade: '4K Ultra HD' },
    { id: 'pt-720-hls', formato: 'hls', codec: 'h264' as const, idioma: 'pt-br', qualidade: '720p HD', priorityBoost: 30 },
    { id: 'pt-1080-hls', formato: 'hls', codec: 'h264' as const, idioma: 'pt-br', qualidade: '1080p Full HD' },
    { id: 'pt-1080-mp4', formato: 'mp4', codec: 'h264' as const, idioma: 'pt-br', qualidade: '1080p FHD' },
    { id: 'pt-4k-mp4', formato: 'mp4', codec: 'h264' as const, idioma: 'pt-br', qualidade: '4K UHD' },
  ];
  const sorted = sortBrowserCompatibleFirst(input);
  assert.equal(sorted[0].id, 'pt-1080-hls');
  assert.equal(sorted[1].id, 'pt-1080-mp4');
  assert.equal(sorted[2].id, 'pt-720-hls');
  assert.equal(sorted[3].id, 'en-h264');
  assert.equal(sorted[4].id, 'pt-4k');
  assert.equal(sorted[5].id, 'pt-4k-mp4');
  assert.equal(sorted[6].id, 'hevc');

  const wideVsNarrow = sortBrowserCompatibleFirst([
    { id: 'narrow-1080', formato: 'mp4', codec: 'h264', idioma: 'pt-br', qualidade: '1080p Full HD', videoWidth: 1440, videoHeight: 1080, verified: true, priorityBoost: 10 },
    { id: 'wide-1080', formato: 'mp4', codec: 'h264', idioma: 'pt-br', qualidade: '1080p Full HD', videoWidth: 1920, videoHeight: 1080, verified: true, priorityBoost: 0 },
  ]);
  assert.equal(wideVsNarrow[0].id, 'wide-1080');

  assert.equal(isLikelyHevcStream('https://x/1080_h265/m.m3u8'), true);
  assert.equal(isUltraHdQuality('1080p Ultra FHD (Master)'), true);
  assert.equal(
    inferStreamFormatFromUrlOrMeta('https://cdn.example.com/movie/aHR0cDovL2Nkbi5leGFtcGxlLmNvbS9maWxtZS5tcDQ'),
    'mp4'
  );
  assert.equal(inferStreamFormatFromUrlOrMeta('https://cdn.example.com/playlist.m3u8'), 'hls');

  // Verify MP4 FourCC codec byte scanning (avc1 vs hvc1/hev1)
  const hvcSample = new TextEncoder().encode('ftypisom....moov....trak....hvc1....');
  const avcSample = new TextEncoder().encode('ftypisom....isomiso2avc1mp41....');
  assert.equal(detectMp4CodecFromBytes(hvcSample), 'h265');
  assert.equal(detectMp4CodecFromBytes(avcSample), 'h264');

  // Verify fast verified stream outranks slower stream
  const latencyRanked = sortBrowserCompatibleFirst([
    { id: 'slow', formato: 'hls', codec: 'h264', idioma: 'pt-br', qualidade: '1080p', verified: true, latencyMs: 1800 },
    { id: 'fast', formato: 'hls', codec: 'h264', idioma: 'pt-br', qualidade: '1080p', verified: true, latencyMs: 210 },
  ]);
  assert.equal(latencyRanked[0].id, 'fast');
});

test('classifyVideoDimensions, parseHlsMasterMaxDimensions, parseMp4TkhdDimensions, and parseH264SpsFromSegmentBytes detect true resolution', () => {
  assert.equal(classifyVideoDimensions(1920, 800)?.quality, '1080p Full HD');
  assert.equal(classifyVideoDimensions(1440, 1080)?.quality, '1080p Full HD');
  assert.equal(classifyVideoDimensions(1440, 720)?.quality, '720p HD');
  assert.equal(classifyVideoDimensions(1280, 534)?.quality, '720p HD');
  assert.equal(classifyVideoDimensions(854, 426)?.quality, '480p HD');
  assert.equal(classifyVideoDimensions(3840, 2160)?.quality, '4K UHD');

  const m3u8 = [
    '#EXTM3U',
    '#EXT-X-STREAM-INF:BANDWIDTH=852000,RESOLUTION=1280x720',
    '720.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=8305864,RESOLUTION=1920x1080',
    '1080.m3u8',
  ].join('\n');
  const masterMeta = parseHlsMasterMaxDimensions(m3u8);
  assert.equal(masterMeta?.meta.quality, '1080p Full HD');
  assert.equal(masterMeta?.bandwidth, 8305864);

  // Synthetic MP4 tkhd v0 box containing 1920x1080
  const mp4Buf = new Uint8Array(120);
  mp4Buf.set([0x74, 0x6b, 0x68, 0x64], 8); // 'tkhd' at 8
  mp4Buf[12] = 0; // version 0
  mp4Buf[8 + 80] = (1920 >> 8) & 0xff;
  mp4Buf[8 + 81] = 1920 & 0xff;
  mp4Buf[8 + 84] = (1080 >> 8) & 0xff;
  mp4Buf[8 + 85] = 1080 & 0xff;
  const mp4Dims = parseMp4TkhdDimensions(mp4Buf);
  assert.equal(mp4Dims?.width, 1920);
  assert.equal(mp4Dims?.height, 1080);
  assert.equal(mp4Dims?.quality, '1080p Full HD');

  // Real H.264 High Profile 1920x1080 SPS NAL in Annex-B
  const annexB1080 = new Uint8Array([
    0x00, 0x00, 0x01, 0x67, 0x64, 0x00, 0x28, 0xac, 0xd9, 0x40, 0x78, 0x02,
    0x27, 0xe5, 0xc0, 0x44, 0x00, 0x00, 0x01, 0x68,
  ]);
  const spsMeta = parseH264SpsFromSegmentBytes(annexB1080);
  assert.equal(spsMeta?.width, 1920);
  assert.equal(spsMeta?.height, 1080);
  assert.equal(spsMeta?.quality, '1080p Full HD');
});

test('containsForbiddenSourceNames detects leaked provider names', () => {
  assert.equal(containsForbiddenSourceNames('Servidor 1 · PT-BR 4K'), false);
  assert.equal(containsForbiddenSourceNames('RIVO Server 6'), true);
  assert.equal(containsForbiddenSourceNames('PlayerFlix VIP'), true);
  assert.equal(containsForbiddenSourceNames('WatchPlay Dublado'), true);
  assert.equal(containsForbiddenSourceNames('FenixHub 4K'), true);
  assert.equal(containsForbiddenSourceNames('Veyra Clusters'), true);
});

test('formatClock, formatRemainingMinutes, and filterCatalogTitles behave accurately', () => {
  assert.equal(formatClock(12), '0:12');
  assert.equal(formatClock(7381), '2:03:01');
  assert.equal(formatRemainingMinutes(5400, 0), 'Restam 1h 30m');
  assert.equal(
    filterCatalogTitles(
      [
        { title: 'Interestelar', mediaType: 'movie', genres: ['Ficção', 'Drama'], network: 'Paramount+' },
        { title: 'Stranger Things', mediaType: 'series', genres: ['Ficção', 'Suspense'], network: 'Netflix' },
      ],
      { mediaType: 'series', network: 'Netflix', query: 'stranger' }
    ).length,
    1
  );
});

test('parseTheIntroDbV2Response, parseAniSkipResponse, and findActiveSkipSegment extract exact intro windows', () => {
  const tvSegs = parseTheIntroDbV2Response({
    intro: [{ start_ms: 274662, end_ms: 324128 }],
    recap: [{ start_ms: 0, end_ms: 0 }],
    credits: [
      { start_ms: 275985, end_ms: 324887 },
      { start_ms: 3193450, end_ms: null },
    ],
  });
  assert.equal(tvSegs.length, 2);
  assert.equal(tvSegs[0].type, 'intro');
  assert.equal(Math.round(tvSegs[0].start), 275);
  assert.equal(Math.round(tvSegs[0].end!), 324);
  assert.equal(tvSegs[1].type, 'outro');
  assert.equal(Math.round(tvSegs[1].start), 3193);

  const animeSegs = parseAniSkipResponse({
    found: true,
    results: [
      { skipType: 'op', interval: { startTime: 47.365, endTime: 137.365 } },
      { skipType: 'ed', interval: { startTime: 1342.795, endTime: 1430.616 } },
    ],
  });
  assert.equal(animeSegs.length, 2);
  assert.equal(findActiveSkipSegment(animeSegs, 30), null);
  assert.equal(findActiveSkipSegment(animeSegs, 52)?.type, 'intro');
  assert.equal(findActiveSkipSegment(animeSegs, 137), null);

  assert.equal(
    shouldShowNextEpisodeCard({
      isSeries: true,
      hasNextEpisode: true,
      currentTime: 1350,
      duration: 1450,
      segments: animeSegs,
      dismissed: false,
    }),
    true
  );
  assert.equal(
    shouldShowNextEpisodeCard({
      isSeries: true,
      hasNextEpisode: true,
      currentTime: 600,
      duration: 1450,
      segments: animeSegs,
      dismissed: false,
    }),
    false
  );
});

test('resolveNextEpisode advances within season and across season boundaries', () => {
  const eps = [
    { season: 1, episode: 1, title: 'Ep 1' },
    { season: 1, episode: 2, title: 'Ep 2' },
  ];
  assert.deepEqual(resolveNextEpisode({ season: 1, episode: 1, episodes: eps, seasonsCount: 2 }), {
    season: 1,
    episode: 2,
    title: 'Ep 2',
  });
  assert.deepEqual(resolveNextEpisode({ season: 1, episode: 2, episodes: eps, seasonsCount: 2 }), {
    season: 2,
    episode: 1,
    title: 'Episódio 1',
  });
  assert.equal(resolveNextEpisode({ season: 2, episode: 1, episodes: [{ season: 2, episode: 1 }], seasonsCount: 2 }), null);
});

