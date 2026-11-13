import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeAnrollBloggerSource,
  detectTitleAudioKind,
  extractAnivideoM3u8Urls,
  extractBloggerMp4Urls,
  extractEpisodeNumberFromEntry,
  extractSeasonHint,
  matchExactEpisode,
  pickTopAnimeCandidates,
  scoreAnimeCandidate,
} from './animeMatcher';

test('extractSeasonHint parses Portuguese, English, Roman numeral, and trailing season numbers', () => {
  assert.equal(extractSeasonHint('Shingeki no Kyojin 2ª Temporada Dublado'), 2);
  assert.equal(extractSeasonHint('Attack on Titan Season 3'), 3);
  assert.equal(extractSeasonHint('Solo Leveling 2: Arise from the Shadow'), null);
  assert.equal(extractSeasonHint('Jujutsu Kaisen 2 Dublado', ['Jujutsu Kaisen']), 2);
  assert.equal(extractSeasonHint('Mob Psycho 100 II'), 2);
  assert.equal(extractSeasonHint('Mob Psycho 100', ['Mob Psycho 100']), null);
  assert.equal(extractSeasonHint('Attack on Titan The Final Season'), 4);
});

test('scoreAnimeCandidate prevents false positives and wrong-season picks', () => {
  const aotQueries = ['Shingeki no Kyojin', 'Attack on Titan'];

  // Unrelated anime sharing "Shingeki no" must be rejected
  assert.equal(scoreAnimeCandidate('Shingeki no Bahamut: Genesis', aotQueries, 1), -1);

  // Movie/spin-off must be rejected for TV series
  assert.equal(scoreAnimeCandidate('Shingeki no Kyojin Movie 1', aotQueries, 1, 'series'), -1);
  assert.equal(scoreAnimeCandidate('Shingeki! Kyojin Chuugakkou', aotQueries, 1, 'series'), -1);

  // Season 1 score > Season 2 score when requesting Season 1
  const s1Score = scoreAnimeCandidate('Shingeki no Kyojin Dublado', aotQueries, 1, 'series');
  const s2Score = scoreAnimeCandidate('Shingeki no Kyojin 2ª Temporada Dublado', aotQueries, 1, 'series');
  assert.ok(s1Score >= 100);
  assert.ok(s1Score > s2Score);

  // Season 2 score > Season 1 score when requesting Season 2
  const s2TargetS2Score = scoreAnimeCandidate('Shingeki no Kyojin 2ª Temporada Dublado', aotQueries, 2, 'series');
  const s2TargetS1Score = scoreAnimeCandidate('Shingeki no Kyojin Dublado', aotQueries, 2, 'series');
  assert.ok(s2TargetS2Score > s2TargetS1Score);
});

test('pickTopAnimeCandidates selects top dubbed and subbed matches for exact season', () => {
  const candidates = [
    { url: 'https://ex.test/aot-s2-dub', title: 'Shingeki no Kyojin 2ª Temporada Dublado' },
    { url: 'https://ex.test/aot-s1-leg', title: 'Shingeki no Kyojin Legendado' },
    { url: 'https://ex.test/aot-s1-dub', title: 'Shingeki no Kyojin Dublado' },
    { url: 'https://ex.test/bahamut', title: 'Shingeki no Bahamut: Genesis' },
    { url: 'https://ex.test/aot-movie', title: 'Attack on Titan Movie' },
  ];

  const pickedS1 = pickTopAnimeCandidates(candidates, ['Shingeki no Kyojin', 'Attack on Titan'], 1, 'series', 1);
  assert.equal(pickedS1.length, 2);
  assert.equal(pickedS1[0].url, 'https://ex.test/aot-s1-dub');
  assert.equal(pickedS1[0].audioKind, 'dublado');
  assert.equal(pickedS1[1].url, 'https://ex.test/aot-s1-leg');
  assert.equal(pickedS1[1].audioKind, 'legendado');
});

test('detectTitleAudioKind and matchExactEpisode handle episode formats and absolute episode fallback', () => {
  assert.equal(detectTitleAudioKind('Solo Leveling Dublado'), 'dublado');
  assert.equal(detectTitleAudioKind('Solo Leveling Todos os Episódios'), 'unknown');

  assert.equal(extractEpisodeNumberFromEntry('Episódio 05', 'https://ex.test/video/123'), 5);
  assert.equal(extractEpisodeNumberFromEntry('Assistir', 'https://ex.test/episodios/jjk-episodio-14/'), 14);

  const entries = [
    { url: 'https://ex.test/ep-1', text: 'Episódio 1' },
    { url: 'https://ex.test/ep-25', text: 'Episódio 25' },
    { url: 'https://ex.test/ep-26', text: 'Episódio 26' },
  ];
  assert.equal(matchExactEpisode(entries, 1, 26)?.url, 'https://ex.test/ep-1');
  assert.equal(matchExactEpisode(entries, 1, 26, true)?.url, 'https://ex.test/ep-26');
  assert.equal(matchExactEpisode(entries, 1, undefined, true), null);
  assert.equal(matchExactEpisode(entries, 25)?.url, 'https://ex.test/ep-25');
  assert.equal(matchExactEpisode(entries, 99), null);
});

test('decodeAnrollBloggerSource decodes base64 reversed token into Blogger video.g URL', () => {
  const token = 'AD6v5dzD6j9pExampleToken123';
  const reversed = token.split('').reverse().join('');
  const b64 = Buffer.from(reversed, 'utf-8').toString('base64');
  const embed = `https://anroll.cc/player/?source=${encodeURIComponent(b64)}`;
  assert.equal(decodeAnrollBloggerSource(embed), `https://www.blogger.com/video.g?token=${encodeURIComponent(token)}`);
  assert.equal(decodeAnrollBloggerSource('https://anroll.cc/player/'), null);
});

test('extractAnivideoM3u8Urls and extractBloggerMp4Urls extract playable media URLs cleanly', () => {
  const anivideoHtml = `
    <iframe src="https://api.anivideo.net/videohls.php?d=https%3A%2F%2Fcdn-sv01.maximaimg.online%2Fstream%2Fs%2Fep1%2Findex.m3u8&amp;id=1"></iframe>
    <iframe src="https://api.anivideo.net/videohls.php?d=https%3A%2F%2Fcdn-sv01.maximaimg.online%2Fstream%2Fs%2Fep1%2Findex.m3u8"></iframe>
  `;
  assert.deepEqual(extractAnivideoM3u8Urls(anivideoHtml), [
    'https://cdn-sv01.maximaimg.online/stream/s/ep1/index.m3u8',
  ]);

  const bloggerHtml = `
    &quot;https://rr1---sn.googlevideo.com/videoplayback?id\\u003d1\\u0026itag\\u003d18&quot;
    &quot;https://rr1---sn.googlevideo.com/videoplayback?id\\u003d1\\u0026itag\\u003d22&quot;
  `;
  const mp4s = extractBloggerMp4Urls(bloggerHtml);
  assert.equal(mp4s.length, 2);
  assert.equal(mp4s[0].quality, '720p HD');
  assert.ok(mp4s[0].url.includes('itag=22'));
  assert.equal(mp4s[1].quality, '360p');
});
