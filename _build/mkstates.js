// Build one page per state listed in states.data.json, at ../<slug>/index.html
const fs = require('fs');
const path = require('path');

const here = __dirname;
const OUT = path.join(here, '..');
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');

const tpl = read('state.template.html');
const data = JSON.parse(read('states.data.json'));
const shapes = JSON.parse(read('states.out.json'));
const glyphs = JSON.parse(read('logo.paths.json'));
const icons = JSON.parse(read('icons.json'));

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const logoGlyphs = glyphs.map((d) => `\n    <path d="${d}" fill="currentColor"/>`).join('');

const SOCIALS = [
  ['Spotify', 'spotify', 'https://open.spotify.com/show/3lVeTOxvayjJ8xgR7nVGGZ'],
  ['Apple Podcasts', 'applepodcasts', 'https://podcasts.apple.com/us/podcast/id1786858496'],
  ['YouTube', 'youtube', 'https://youtube.com'],
  ['Instagram', 'instagram', 'https://www.instagram.com/heatpumpguides/'],
  ['Threads', 'threads', 'https://www.threads.com/@heatpumpguides/'],
  ['Facebook', 'facebook', 'https://www.facebook.com/HeatPumpGuides/'],
  ['LinkedIn', 'linkedin', 'https://www.linkedin.com/company/heat-pump-guides/'],
];
const socials = SOCIALS.map(([name, key, href]) =>
  `<a class="ft-soc" href="${href}" target="_blank" rel="noopener" aria-label="${name}">`
  + `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[key]}"/></svg></a>`
).join('\n        ');

const bySlug = Object.fromEntries(shapes.map((s) => [s.slug, s]));

// A stat is only rendered when it has a real value. Missing data leaves no gap
// and, more to the point, invents no numbers.
function figure(value, unit, label, note) {
  if (value == null || value === '') return '';
  return '<li class="fig">'
    + `<p class="fig-n">${esc(value)}<span class="fig-u">${esc(unit || '')}</span></p>`
    + `<p class="fig-l">${esc(label)}</p>`
    + (note ? `<p class="fig-s">${esc(note)}</p>` : '')
    + '</li>';
}

let built = 0;
for (const [slug, s] of Object.entries(data)) {
  if (slug.startsWith('_')) continue;

  const shape = bySlug[slug];
  if (!shape) throw new Error(`no map geometry for slug "${slug}" - check spelling against states.out.json`);

  // Frame the state's own outline in its own viewBox, lifted from the homepage map.
  const pad = Math.max(shape.w, shape.h) * 0.07;
  const vb = [
    (shape.cx - shape.w / 2 - pad).toFixed(1),
    (shape.cy - shape.h / 2 - pad).toFixed(1),
    (shape.w + pad * 2).toFixed(1),
    (shape.h + pad * 2).toFixed(1),
  ].join(' ');

  const figures = [
    figure(s.janLow, '°F', 'Coldest month average low', `${s.refCity} · ${s.climateSource}`),
    figure(s.julHigh, '°F', 'Warmest month average high', `${s.refCity} · ${s.climateSource}`),
    figure(s.designTemp, '°F', 'Winter design temperature', 'ASHRAE 99% · sizing basis'),
    figure(s.hpShare, '%', 'Homes heated by a heat pump', `${s.hpShareSource || ''}`),
  ].filter(Boolean).join('\n        ');

  const incentives = (s.incentives || []).map((i) =>
    '<li class="inc-row">'
    + `<h3 class="inc-n">${esc(i.name)}</h3>`
    + `<p class="inc-d">${esc(i.note)}</p>`
    + (i.url ? `<a class="inc-l" href="${esc(i.url)}" target="_blank" rel="noopener">Program details →</a>` : '')
    + '</li>'
  ).join('\n        ');

  const metaDesc = `Heat pump episodes, climate figures and rebate programs for ${s.name}. ${s.refCity} winters average ${s.janLow}°F lows.`;

  const html = tpl
    .replace(/\{\{LOGO_GLYPHS\}\}/g, logoGlyphs)
    .replace(/\{\{SOCIALS\}\}/g, socials)
    .replace(/\{\{SHAPE_VIEWBOX\}\}/g, vb)
    .replace(/\{\{SHAPE_PATH\}\}/g, shape.d)
    .replace(/\{\{FIGURES\}\}/g, figures)
    .replace(/\{\{INCENTIVES\}\}/g, incentives)
    .replace(/\{\{EP_MATCH\}\}/g, esc(JSON.stringify(s.episodes || [])))
    .replace(/\{\{META_DESC\}\}/g, esc(metaDesc))
    .replace(/\{\{INTRO\}\}/g, esc(s.intro))
    .replace(/\{\{COLD_NOTE\}\}/g, esc(s.coldNote || ''))
    .replace(/\{\{JAN_LOW\}\}/g, esc(s.janLow))
    .replace(/\{\{JUL_HIGH\}\}/g, esc(s.julHigh))
    .replace(/\{\{NAME_URL\}\}/g, encodeURIComponent(s.name))
    .replace(/\{\{NAME\}\}/g, esc(s.name))
    .replace(/\{\{ABBR\}\}/g, esc(s.abbr))
    .replace(/\{\{SLUG\}\}/g, slug);

  const left = html.match(/\{\{[A-Z_]+\}\}/g);
  if (left) throw new Error('unreplaced tokens in ' + slug + ': ' + [...new Set(left)].join(', '));

  const dir = path.join(OUT, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`  /${slug}/index.html  ${(html.length / 1024).toFixed(1)} KB`);
  built++;
}
console.log(`built ${built} state page${built === 1 ? '' : 's'}`);
