// Assemble the static index.html and patch the stripe gradient into styles.css.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..');
const here = __dirname;
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');

const tpl = read('index.template.html');
const map = read('map.fragment.html');
const glyphs = JSON.parse(read('logo.paths.json'));
const eps = JSON.parse(read('episodes.fallback.json'));
const icons = JSON.parse(read('icons.json'));
const stripes = read('stripes.css.txt').trim();

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- logo -----------------------------------------------------------------
// currentColor rather than a class: <use> puts these in a shadow tree that
// outside CSS selectors cannot reach, but inherited properties still apply.
const logoGlyphs = glyphs.map((d) => `\n    <path d="${d}" fill="currentColor"/>`).join('');

// --- socials --------------------------------------------------------------
const SOCIALS = [
  ['Spotify', 'spotify', 'https://open.spotify.com/show/3lVeTOxvayjJ8xgR7nVGGZ'],
  ['Apple Podcasts', 'applepodcasts', 'https://podcasts.apple.com/us/podcast/id1786858496'],
  ['YouTube', 'youtube', 'https://youtube.com'],
  ['Instagram', 'instagram', 'https://www.instagram.com/heatpumpguides/'],
  ['Threads', 'threads', 'https://www.threads.com/@heatpumpguides/'],
  ['Facebook', 'facebook', 'https://www.facebook.com/HeatPumpGuides/'],
  ['LinkedIn', 'linkedin', 'https://www.linkedin.com/company/heat-pump-guides/'],
];

const socials = SOCIALS.map(([name, key, href]) => {
  const d = icons[key];
  if (!d) throw new Error('missing icon: ' + key);
  return `<a class="ft-soc" href="${href}" target="_blank" rel="noopener" aria-label="${name}">`
    + `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg></a>`;
}).join('\n        ');

// --- episodes -------------------------------------------------------------
const stripNum = (t) => {
  const m = /^\s*(\d+)\s*[-–—]\s*(.+)$/.exec(t || '');
  return m ? m[2] : (t || '');
};
const noscript = eps.slice(0, 6).map((e) => {
  const d = new Date(e.date);
  const when = isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `<li class="ep-row"><span class="ep-num"></span><div class="ep-main">`
    + `<p class="ep-title"><a href="${esc(e.link)}">${esc(stripNum(e.title))}</a></p>`
    + `<p class="ep-sub">${esc(when)}</p></div></li>`;
}).join('\n          ');

// JSON inside a <script> must not contain a literal </script>
const epsJson = JSON.stringify(eps).replace(/<\//g, '<\\/');

// --- mobile state list ----------------------------------------------------
const states = JSON.parse(read('states.out.json'));
const stateList = states.map((s) => {
  const label = s.name === 'District of Columbia' ? 'Washington DC' : s.name;
  return `<li><a href="/${s.slug}"><span class="st-grid-a">${s.abbr}</span>${esc(label)}</a></li>`;
}).join('\n        ');

// --- write ----------------------------------------------------------------
const html = tpl
  .replace('{{LOGO_GLYPHS}}', logoGlyphs)
  .replace('{{US_MAP}}', map)
  .replace('{{STATE_LIST}}', stateList)
  .replace('{{SOCIALS}}', socials)
  .replace('{{EPS_NOSCRIPT}}', noscript)
  .replace('{{EPS_JSON}}', epsJson);

for (const token of ['{{LOGO_GLYPHS}}', '{{US_MAP}}', '{{STATE_LIST}}', '{{SOCIALS}}', '{{EPS_NOSCRIPT}}', '{{EPS_JSON}}']) {
  if (html.includes(token)) throw new Error('unreplaced token: ' + token);
}

fs.writeFileSync(path.join(OUT, 'index.html'), html);

const cssPath = path.join(OUT, 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');
if (!/--stripes:[^;]+;/.test(css)) throw new Error('no --stripes declaration to patch');
css = css.replace(/--stripes:[^;]+;/, '--stripes: ' + stripes + ';');
fs.writeFileSync(cssPath, css);

console.log('index.html  ', (html.length / 1024).toFixed(1) + ' KB');
console.log('styles.css  ', (css.length / 1024).toFixed(1) + ' KB');
console.log('episodes    ', eps.length, '| socials', SOCIALS.length, '| glyphs', glyphs.length);
