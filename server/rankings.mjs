import gplay from 'google-play-scraper';

const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map();
const allowedCategories = new Set([
  'GAME', 'GAME_ACTION', 'GAME_ROLE_PLAYING', 'GAME_STRATEGY',
  'GAME_CASUAL', 'GAME_PUZZLE', 'GAME_SIMULATION',
]);
const allowedCountries = new Set(['us', 'jp', 'kr', 'tw', 'de', 'gb']);

function parseReleaseDate(value) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalize(game, rank) {
  return {
    appId: game.appId,
    title: game.title,
    developer: game.developer,
    icon: game.icon,
    url: game.url,
    score: game.score,
    scoreText: game.scoreText,
    priceText: game.priceText,
    rank,
    genre: game.genre,
    released: game.released,
    minInstalls: game.minInstalls,
    installs: game.installs,
    offersIAP: game.offersIAP,
    summary: game.summary,
  };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = await mapper(items[index], index); }
      catch { results[index] = items[index]; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchRankings(country, category) {
  const base = { category, country, lang: 'en' };
  const [topFreeRaw, grossingRaw, topPaidRaw] = await Promise.all([
    gplay.list({ ...base, collection: gplay.collection.TOP_FREE, num: 40 }),
    gplay.list({ ...base, collection: gplay.collection.GROSSING, num: 40 }),
    gplay.list({ ...base, collection: gplay.collection.TOP_PAID, num: 30 }),
  ]);

  const ranked = {
    topFree: topFreeRaw.map(normalize),
    grossing: grossingRaw.map(normalize),
    topPaid: topPaidRaw.map(normalize),
  };

  const detailCandidates = new Map();
  Object.values(ranked).forEach((list) => list.slice(0, 15).forEach((game) => detailCandidates.set(game.appId, game)));
  const details = await mapWithConcurrency([...detailCandidates.values()], 6, async (game) => {
    const detail = await gplay.app({ appId: game.appId, country, lang: 'en' });
    return { ...game, ...normalize(detail, game.rank) };
  });
  const detailMap = new Map(details.map((game) => [game.appId, game]));
  const enrich = (list) => list.map((game) => detailMap.get(game.appId) ?? game);
  ranked.topFree = enrich(ranked.topFree);
  ranked.grossing = enrich(ranked.grossing);
  ranked.topPaid = enrich(ranked.topPaid);

  const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const newGames = ranked.topFree
    .filter((game) => parseReleaseDate(game.released) >= cutoff)
    .sort((a, b) => parseReleaseDate(b.released) - parseReleaseDate(a.released))
    .slice(0, 20)
    .map((game, index) => ({ ...game, rank: index + 1 }));

  return { country, category, fetchedAt: new Date().toISOString(), ...ranked, newGames };
}

export async function rankingsMiddleware(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const countryParam = (url.searchParams.get('country') ?? 'us').toLowerCase();
  const categoryParam = url.searchParams.get('category') ?? 'GAME';
  const country = allowedCountries.has(countryParam) ? countryParam : 'us';
  const category = allowedCategories.has(categoryParam) ? categoryParam : 'GAME';
  const key = `${country}:${category}`;
  const cached = cache.get(key);
  const force = url.searchParams.get('refresh') === '1';

  if (!force && cached && Date.now() - cached.time < CACHE_TTL) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(cached.data));
    return;
  }

  try {
    const data = await fetchRankings(country, category);
    cache.set(key, { time: Date.now(), data });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(JSON.stringify(data));
  } catch (error) {
    console.error('Google Play fetch failed:', error?.message ?? error);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Google Play data is temporarily unavailable' }));
  }
}
