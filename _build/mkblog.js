// Build the blog: one page per podcast episode at ../blog/<slug>/, the index at
// ../blog/, the lookup file the homepage and state pages use to link episode
// titles to their posts, and the site-wide sitemap.xml + robots.txt.
//
//   node _build/mkblog.js                 build
//   node _build/mkblog.js --check-links   build, then request every external link
//
// Each post is a folder in _build/blog/<slug>/:
//   post.json        slug, headline, subheading, SEO title/description, dates, related posts
//   article.html     the article body — h2 and below, no page furniture
//   transcript.txt   "[m:ss] paragraph" per line; the timestamps seek the player
//
// Episode facts (audio, date, length, artwork) come from episodes.fallback.json
// and the Spotify/Apple/YouTube links from episode-links.json, both written by
// mkepisodes.js — run that first when a new episode is out.
const fs = require('fs');
const path = require('path');

const here = __dirname;
const OUT = path.join(here, '..');
const SITE = 'https://heatpumpguides.com';
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');

const analytics = read('analytics.html').trim();
const cfg = JSON.parse(read('site.config.json'));
const glyphs = JSON.parse(read('logo.paths.json'));
const icons = JSON.parse(read('icons.json'));
const feed = JSON.parse(read('episodes.fallback.json'));
const links = JSON.parse(read('episode-links.json'));
const tplPost = read('blog-post.template.html');
const tplIndex = read('blog-index.template.html');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ');
const slugify = (s) => strip(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const logoGlyphs = glyphs.map((d) => `\n    <path d="${d}" fill="currentColor"/>`).join('');
const icon = (key, cls) => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[key]}"/></svg>`;
const socials = cfg.socials.map(([name, key, href]) =>
  `<a class="ft-soc" href="${href}" target="_blank" rel="noopener" aria-label="${name}">${icon(key)}</a>`
).join('\n        ');

// ---- dates and durations ----------------------------------------------------
const toDate = (s) => { const d = new Date(s); if (isNaN(d)) throw new Error('bad date: ' + s); return d; };
const human = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const ymd = (d) => d.toISOString().slice(0, 10);
const secs = (hms) => String(hms || '').split(':').map(Number).reduce((a, n) => a * 60 + n, 0);
const mins = (s) => Math.max(1, Math.round(s / 60));
const isoDur = (s) => `PT${Math.floor(s / 60)}M${s % 60}S`;
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const splitNum = (t) => { const m = /^\s*(\d+)\s*[-–—]\s*(.+)$/.exec(t || ''); return m ? { n: Number(m[1]), t: m[2] } : { n: null, t: t || '' }; };

// ---- load posts -------------------------------------------------------------
const BLOG = path.join(here, 'blog');
const REQUIRED = ['guid', 'slug', 'headline', 'subheading', 'seoTitle', 'description', 'published'];

const posts = fs.readdirSync(BLOG, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => {
    const dir = path.join(BLOG, d.name);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'post.json'), 'utf8'));
    for (const k of REQUIRED) if (!meta[k]) throw new Error(`${d.name}/post.json: missing "${k}"`);
    if (meta.slug !== d.name) throw new Error(`${d.name}/post.json: slug "${meta.slug}" must match its folder name`);
    const ep = feed.find((e) => e.guid === meta.guid);
    if (!ep) throw new Error(`${d.name}: guid ${meta.guid} is not in episodes.fallback.json — run mkepisodes.js`);
    const lk = links[meta.guid] || {};
    const s = splitNum(ep.title);
    return {
      ...meta,
      dir,
      n: s.n,
      epTitle: s.t,
      aired: toDate(ep.date),
      durS: secs(ep.dur),
      audio: ep.audio,
      img: ep.img,
      spotify: lk.spotify || '',
      apple: lk.apple || '',
      youtube: lk.youtube || '',
      url: `/blog/${meta.slug}/`,
      article: fs.readFileSync(path.join(dir, 'article.html'), 'utf8').trim(),
      transcript: fs.existsSync(path.join(dir, 'transcript.txt')) ? fs.readFileSync(path.join(dir, 'transcript.txt'), 'utf8') : '',
    };
  })
  .sort((a, b) => b.aired - a.aired);

const bySlug = new Map(posts.map((p) => [p.slug, p]));

// ---- article checks + light processing -------------------------------------
// Pages that exist on the site, for checking internal links. Posts count even
// before they are written to disk.
function pageExists(p) {
  const clean = p.split('#')[0].split('?')[0];
  if (clean === '/' || clean === '') return true;
  const m = /^\/blog\/([^/]+)\/$/.exec(clean);
  if (m) return bySlug.has(m[1]);
  if (!clean.endsWith('/')) return false; // always link the canonical trailing-slash form
  return fs.existsSync(path.join(OUT, clean, 'index.html'));
}

function prepare(p) {
  let html = p.article;
  const where = `${p.slug}/article.html`;
  if (/<h1[\s>]/i.test(html)) throw new Error(`${where}: no <h1> in the article — the headline is the page's h1`);

  // heading ids, and no skipped levels (h2 -> h4)
  const used = new Set();
  let last = 1;
  html = html.replace(/<h([2-6])([^>]*)>([\s\S]*?)<\/h\1>/g, (all, lvl, attrs, inner) => {
    lvl = Number(lvl);
    if (lvl > last + 1) throw new Error(`${where}: <h${lvl}> "${strip(inner)}" skips a level after <h${last}>`);
    last = lvl;
    let id = (/\sid="([^"]+)"/.exec(attrs) || [])[1];
    if (!id) { id = slugify(inner); attrs += ` id="${id}"`; }
    if (used.has(id)) throw new Error(`${where}: duplicate heading id "${id}"`);
    used.add(id);
    return `<h${lvl}${attrs}>${inner}</h${lvl}>`;
  });

  // links: internal ones must resolve; external ones open in a new tab
  const external = [];
  html = html.replace(/<a\s([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (all, pre, href, post, text) => {
    const anchor = strip(text).trim();
    if (!anchor) throw new Error(`${where}: empty link text for ${href}`);
    if (/^(click here|here|this|link|read more)$/i.test(anchor)) throw new Error(`${where}: vague anchor text "${anchor}" for ${href}`);
    if (href.startsWith('#')) {
      if (!used.has(href.slice(1)) && !['listen', 'transcript'].includes(href.slice(1))) throw new Error(`${where}: #${href.slice(1)} is not a heading on this page`);
      return all;
    }
    if (href.startsWith('/')) {
      if (!pageExists(href)) throw new Error(`${where}: internal link ${href} does not match a page on the site`);
      return all;
    }
    if (/^mailto:/.test(href)) return all;
    if (!/^https:\/\//.test(href)) throw new Error(`${where}: link must be https:// — ${href}`);
    if (/[?&](utm_[a-z]+|srsltid|fbclid|gclid)=/.test(href)) throw new Error(`${where}: strip tracking parameters from ${href}`);
    external.push({ href, anchor });
    const attrs = (pre + post).replace(/\s*(target|rel)="[^"]*"/g, '');
    return `<a ${attrs.trim() ? attrs.trim() + ' ' : ''}href="${href}" target="_blank" rel="noopener">${text}</a>`;
  });

  const toc = [...html.matchAll(/<h2[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)]
    .map((m) => `<li><a href="#${m[1]}">${strip(m[2])}</a></li>`)
    .join('\n          ');

  const words = strip(html).split(/\s+/).filter(Boolean).length;
  return { html, toc, words, external };
}

function transcriptHtml(p) {
  const out = [];
  for (const line of p.transcript.split('\n')) {
    if (!line.trim()) continue;
    const m = /^\[(\d+):(\d{2})\]\s+(.+)$/.exec(line.trim());
    if (!m) throw new Error(`${p.slug}/transcript.txt: expected "[m:ss] text", got "${line.slice(0, 60)}"`);
    const t = Number(m[1]) * 60 + Number(m[2]);
    out.push(`<p><button class="ts" type="button" data-t="${t}" aria-label="Play from ${clock(t)}">${clock(t)}</button> ${esc(m[3])}</p>`);
  }
  return out.join('\n          ');
}

// ---- page pieces ------------------------------------------------------------
const PLATFORMS = [['spotify', 'Spotify'], ['apple', 'Apple Podcasts', 'applepodcasts'], ['youtube', 'YouTube']];
const listenOn = (p) => PLATFORMS.filter(([k]) => p[k]).map(([k, label, ic]) =>
  `<a class="listen-on-a" href="${esc(p[k])}" target="_blank" rel="noopener">${icon(ic || k)}<span>${label}</span></a>`
).join('\n            ');

function byline() {
  const a = cfg.author;
  return a.url ? `<a href="${esc(a.url)}" rel="author">${esc(a.name)}</a>` : esc(a.name);
}

function relatedHtml(p) {
  const rel = (p.related || []).map((s) => {
    const r = bySlug.get(s);
    if (!r) throw new Error(`${p.slug}/post.json: related post "${s}" does not exist`);
    return r;
  });
  if (!rel.length) return '';
  return `
  <hr class="rule rule--flip">

  <section class="sec" aria-labelledby="relH">
    <div class="wrap">
      <div class="sec-head">
        <div>
          <p class="eyebrow">Keep listening</p>
          <h2 class="h2" id="relH">Related episodes</h2>
        </div>
        <a class="ep-out" href="/blog/">All episodes →</a>
      </div>
      <ul class="post-cards">
        ${rel.map(card).join('\n        ')}
      </ul>
    </div>
  </section>`;
}

function card(p) {
  return `<li class="post-card">
          <p class="post-card-meta"><span>Episode ${p.n}</span><span>${mins(p.durS)} min listen</span></p>
          <h3 class="post-card-t"><a href="${p.url}">${esc(p.headline)}</a></h3>
          <p class="post-card-d">${esc(p.subheading)}</p>
        </li>`;
}

// Interview episodes: post.json -> guest { name, jobTitle, company, url, areaServed }
function guestLd(g) {
  if (!g.name) throw new Error('post.json guest: missing "name"');
  const person = { '@type': 'Person', name: g.name };
  if (g.jobTitle) person.jobTitle = g.jobTitle;
  if (g.company) {
    person.worksFor = { '@type': 'HVACBusiness', name: g.company };
    if (g.url) person.worksFor.url = g.url;
    if (g.areaServed) person.worksFor.areaServed = g.areaServed;
  }
  return person;
}

function jsonLd(p, words) {
  const url = SITE + p.url;
  const org = { '@type': 'Organization', '@id': SITE + '/#org', name: 'Heat Pump Guides', url: SITE + '/',
    logo: { '@type': 'ImageObject', url: SITE + '/assets/apple-touch-icon.png' } };
  const author = { '@type': 'Person', name: cfg.author.name };
  if (cfg.author.url) author.url = cfg.author.url;
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': url + '#article',
        headline: p.headline,
        description: p.description,
        url,
        mainEntityOfPage: url,
        image: p.img,
        datePublished: p.published,
        dateModified: p.updated || p.published,
        wordCount: words,
        author,
        publisher: org,
        about: { '@id': url + '#episode' },
      },
      {
        '@type': 'PodcastEpisode',
        '@id': url + '#episode',
        name: p.epTitle,
        episodeNumber: p.n,
        datePublished: ymd(p.aired),
        timeRequired: isoDur(p.durS),
        url,
        image: p.img,
        associatedMedia: { '@type': 'MediaObject', contentUrl: p.audio, encodingFormat: 'audio/mpeg', duration: isoDur(p.durS) },
        partOfSeries: { '@type': 'PodcastSeries', name: 'Heat Pump Guides', url: SITE + '/', webFeed: 'https://anchor.fm/s/f8c1cc3c/podcast/rss' },
        sameAs: [p.spotify, p.apple, p.youtube].filter(Boolean),
        ...(p.guest ? { actor: guestLd(p.guest) } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blog/' },
          { '@type': 'ListItem', position: 3, name: p.headline, item: url },
        ],
      },
    ],
  };
  return JSON.stringify(data, null, 1).replace(/<\//g, '<\\/');
}

function fill(tpl, map, where) {
  let html = tpl;
  for (const [k, v] of Object.entries(map)) html = html.split(`{{${k}}}`).join(v);
  const left = html.match(/\{\{[A-Z_]+\}\}/g);
  if (left) throw new Error(`unreplaced tokens in ${where}: ${[...new Set(left)].join(', ')}`);
  return html;
}

// ---- build posts ------------------------------------------------------------
const allExternal = [];
for (const p of posts) {
  const art = prepare(p);
  allExternal.push(...art.external.map((x) => ({ ...x, slug: p.slug })));
  const updated = p.updated && p.updated !== p.published ? toDate(p.updated) : null;

  const html = fill(tplPost, {
    ANALYTICS: analytics,
    LOGO_GLYPHS: logoGlyphs,
    SOCIALS: socials,
    SEO_TITLE: esc(p.seoTitle),
    META_DESC: esc(p.description),
    CANONICAL: SITE + p.url,
    OG_IMAGE: esc(p.img),
    PUBLISHED: p.published,
    MODIFIED: p.updated || p.published,
    JSON_LD: jsonLd(p, art.words),
    N: String(p.n),
    HEADLINE: esc(p.headline),
    SUBHEADING: esc(p.subheading),
    BYLINE: byline(),
    AUTHOR: esc(cfg.author.name),
    AIRED_ISO: ymd(p.aired),
    AIRED: human(p.aired),
    UPDATED_NOTE: updated ? ` · <span>Updated <time datetime="${ymd(updated)}">${human(updated)}</time></span>` : '',
    READ_MIN: String(Math.max(1, Math.round(art.words / 230))),
    LISTEN_MIN: String(mins(p.durS)),
    AUDIO: esc(p.audio),
    ART: esc(p.img),
    EP_TITLE: esc(p.epTitle),
    DURATION: clock(p.durS),
    LISTEN_ON: listenOn(p),
    TOC: art.toc,
    ARTICLE: art.html,
    TRANSCRIPT: transcriptHtml(p),
    RELATED: relatedHtml(p),
  }, p.slug);

  const dir = path.join(OUT, 'blog', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`  /blog/${p.slug}/  ${(html.length / 1024).toFixed(1)} KB  ${art.words} words  ${art.external.length} external links`);
}

// ---- blog index -------------------------------------------------------------
const indexHtml = fill(tplIndex, {
  ANALYTICS: analytics,
  LOGO_GLYPHS: logoGlyphs,
  SOCIALS: socials,
  COUNT: String(posts.length),
  ROWS: posts.map((p) => `<li class="blog-row">
          <span class="ep-num">${p.n}</span>
          <div class="blog-row-main">
            <h2 class="blog-row-t"><a href="${p.url}">${esc(p.headline)}</a></h2>
            <p class="blog-row-d">${esc(p.subheading)}</p>
            <p class="blog-row-m"><time datetime="${ymd(p.aired)}">${human(p.aired)}</time> · ${mins(p.durS)} min listen</p>
          </div>
          <a class="blog-row-go" href="${p.url}" aria-hidden="true" tabindex="-1">Read &amp; listen →</a>
        </li>`).join('\n        '),
  ITEMLIST: JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Heat Pump Guides blog',
    url: SITE + '/blog/',
    publisher: { '@type': 'Organization', name: 'Heat Pump Guides', url: SITE + '/' },
    blogPost: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.headline, url: SITE + p.url, datePublished: p.published })),
  }, null, 1).replace(/<\//g, '<\\/'),
}, 'blog index');
fs.mkdirSync(path.join(OUT, 'blog'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'blog', 'index.html'), indexHtml);

// Lookup for the homepage and state pages: which episodes have a post yet.
fs.writeFileSync(path.join(OUT, 'blog', 'posts.json'), JSON.stringify(posts.map((p) => ({
  guid: p.guid, n: p.n, url: p.url, headline: p.headline, spotify: p.spotify, apple: p.apple, youtube: p.youtube,
}))));
console.log(`  /blog/  index of ${posts.length} posts, posts.json`);

// ---- sitemap + robots -------------------------------------------------------
// Every page on the site, so search engines find new posts without waiting to
// crawl a link to them.
const states = JSON.parse(read('states.out.json'));
const urls = [
  { loc: '/', pri: '1.0' },
  { loc: '/blog/', lastmod: posts.length ? posts.map((p) => p.updated || p.published).sort().pop() : '', pri: '0.9' },
  ...posts.map((p) => ({ loc: p.url, lastmod: p.updated || p.published, pri: '0.8' })),
  ...states.map((s) => ({ loc: `/${s.slug}/`, pri: '0.7' })),
  { loc: '/apply/', pri: '0.5' },
  { loc: '/privacy/', pri: '0.2' },
  { loc: '/terms/', pri: '0.2' },
];
for (const u of urls) if (!pageExists(u.loc)) throw new Error('sitemap: no page at ' + u.loc);
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + urls.map((u) => `  <url><loc>${SITE}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.pri}</priority></url>`).join('\n')
  + '\n</urlset>\n';
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`  sitemap.xml  ${urls.length} URLs, robots.txt`);

// ---- optional: request every external link ------------------------------------
if (process.argv.includes('--check-links')) {
  (async () => {
    const seen = new Map();
    for (const l of allExternal) {
      if (!seen.has(l.href)) {
        let status;
        try {
          const r = await fetch(l.href, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
          status = r.status;
        } catch (err) { status = 'ERR ' + err.message; }
        seen.set(l.href, status);
      }
      const st = seen.get(l.href);
      console.log(`${st === 200 ? '  ok ' : '  !! '} ${String(st).padEnd(4)} ${l.slug}  "${l.anchor}"  ${l.href}`);
    }
    console.log('\nA 200 is not proof a link is right, and a 403 from a government site is usually bot');
    console.log('protection, not a dead link. Open anything unfamiliar in a browser before trusting it.');
  })();
}
