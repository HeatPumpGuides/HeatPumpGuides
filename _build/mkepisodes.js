// Refresh the baked episode data from the live podcast feed, and look up each
// episode's own page on Spotify, Apple Podcasts and YouTube.
//
//   node _build/mkepisodes.js
//
// Writes:
//   feed.xml                 raw copy of the RSS feed
//   episodes.fallback.json   what the homepage paints before the live feed arrives
//   episode-links.json       guid -> { spotify, apple, youtube } per-episode URLs
//
// Links already in episode-links.json are kept; only missing ones are looked up,
// so a hand-corrected link is never overwritten. Spotify and YouTube can take a
// few hours to list a new episode — re-run later and the gap fills in.
const fs = require('fs');
const path = require('path');

const here = __dirname;
const FEED = 'https://anchor.fm/s/f8c1cc3c/podcast/rss';
const APPLE_ID = '1786858496';
const SPOTIFY_SHOW = 'https://open.spotify.com/show/3lVeTOxvayjJ8xgR7nVGGZ';
const YOUTUBE_CHANNEL = 'https://www.youtube.com/@HeatPumpGuides';
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'Accept-Language': 'en' };

// Spotify serves a script-only app shell to full browser user agents, but the
// server-rendered episode list to a bare one.
const BARE = { 'User-Agent': 'Mozilla/5.0' };
const text = async (url, headers = UA) => { const r = await fetch(url, { headers }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.text(); };
const json = async (url) => JSON.parse(await text(url));

const decode = (s) => s
  .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
  .trim();
const tag = (xml, name) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml); return m ? decode(m[1]) : ''; };
const attr = (xml, name, a) => { const m = new RegExp(`<${name}[^>]*\\s${a}="([^"]*)"`).exec(xml); return m ? decode(m[1]) : ''; };

// "9 - Which US States…" -> 9
const numOf = (t) => { const m = /^\s*(\d+)\s*[-–—]/.exec(t || ''); return m ? Number(m[1]) : null; };

async function main() {
  const xml = await text(FEED);
  fs.writeFileSync(path.join(here, 'feed.xml'), xml);

  const showArt = attr(xml.split('<item>')[0], 'itunes:image', 'href');
  const eps = xml.split('<item>').slice(1).map((it) => {
    const raw = tag(it, 'description');
    const desc = raw.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const title = tag(it, 'title');
    return {
      title,
      n: numOf(title),
      guid: tag(it, 'guid'),
      date: tag(it, 'pubDate'),
      dur: tag(it, 'itunes:duration'),
      link: tag(it, 'link'),
      audio: attr(it, 'enclosure', 'url'),
      img: attr(it, 'itunes:image', 'href') || showArt,
      desc: desc.slice(0, 400),
    };
  });
  fs.writeFileSync(path.join(here, 'episodes.fallback.json'), JSON.stringify(eps));
  console.log('feed        ', eps.length, 'episodes');

  // ---- per-episode platform links -----------------------------------------
  const linksPath = path.join(here, 'episode-links.json');
  const links = fs.existsSync(linksPath) ? JSON.parse(fs.readFileSync(linksPath, 'utf8')) : {};
  for (const e of eps) links[e.guid] = Object.assign({ n: e.n, title: e.title }, links[e.guid]);
  const missing = (k) => eps.filter((e) => !links[e.guid][k]);

  // Apple: the lookup API carries each episode's RSS guid, so it matches exactly.
  if (missing('apple').length) {
    try {
      const r = await json(`https://itunes.apple.com/lookup?id=${APPLE_ID}&entity=podcastEpisode&limit=200`);
      for (const x of r.results) {
        if (!x.episodeGuid || !links[x.episodeGuid] || links[x.episodeGuid].apple) continue;
        links[x.episodeGuid].apple = x.trackViewUrl.replace(/[?&]uo=\d+/, '');
      }
    } catch (err) { console.warn('apple lookup failed:', err.message); }
  }

  // Spotify and YouTube: collect episode ids from the public show/channel page,
  // then read each one's title over oEmbed and match on the episode number.
  async function byNumber(key, pageUrls, idRe, oembed, toUrl, headers) {
    if (!missing(key).length) return;
    const ids = new Set();
    for (const u of pageUrls) {
      try { for (const m of (await text(u, headers)).matchAll(idRe)) ids.add(m[1]); } catch (err) { console.warn(key, 'page failed:', err.message); }
    }
    const want = new Map(missing(key).map((e) => [e.n, e]));
    for (const id of ids) {
      if (!want.size) break;
      try {
        const n = numOf((await json(oembed(id))).title);
        if (n != null && want.has(n)) { links[want.get(n).guid][key] = toUrl(id); want.delete(n); }
      } catch (err) { /* private or removed item; skip */ }
    }
  }
  await byNumber('spotify', [SPOTIFY_SHOW], /\/episode\/([A-Za-z0-9]{22})/g,
    (id) => `https://open.spotify.com/oembed?url=https://open.spotify.com/episode/${id}`,
    (id) => `https://open.spotify.com/episode/${id}`, BARE);
  await byNumber('youtube', [YOUTUBE_CHANNEL + '/videos', YOUTUBE_CHANNEL + '/podcasts', YOUTUBE_CHANNEL], /"videoId":"([A-Za-z0-9_-]{11})"/g,
    (id) => `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${id}`,
    (id) => `https://www.youtube.com/watch?v=${id}`);

  fs.writeFileSync(linksPath, JSON.stringify(links, null, 2) + '\n');
  for (const k of ['spotify', 'apple', 'youtube']) {
    const gap = missing(k).map((e) => e.n);
    console.log(k.padEnd(12), gap.length ? 'missing for episode ' + gap.join(', ') : 'all found');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
