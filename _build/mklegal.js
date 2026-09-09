// Build the standalone legal pages at ../privacy/ and ../terms/
const fs = require('fs');
const path = require('path');

const here = __dirname;
const OUT = path.join(here, '..');
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');

// Shared with mkstates.js via site.config.json so the address cannot drift
// between the state CTAs and the legal pages.
const cfg = JSON.parse(read('site.config.json'));
const CONTACT_EMAIL   = cfg.contactEmail;
const GOVERNING_STATE = cfg.governingState;   // TODO: confirm state of incorporation
const UPDATED         = cfg.legalUpdated;

const tpl = read('legal.template.html');
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

const PAGES = [
  { slug: 'privacy', file: 'legal/privacy.html', title: 'Privacy Policy',
    desc: 'What Heat Pump Guides collects, how it is used, and what happens to your details when we connect you with a contractor.' },
  { slug: 'terms', file: 'legal/terms.html', title: 'Terms of Service',
    desc: 'The terms covering use of the Heat Pump Guides website, podcast, and contractor referrals.' },
];

for (const p of PAGES) {
  let body = read(p.file)
    .replace(/CONTACT_EMAIL/g, CONTACT_EMAIL)
    .replace(/GOVERNING_STATE/g, GOVERNING_STATE);

  // Table of contents, built from the h2s so it can never drift from the body.
  const toc = [...body.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)]
    .map((m) => `<li><a href="#${m[1]}">${m[2]}</a></li>`)
    .join('\n        ');

  const html = tpl
    .replace(/\{\{LOGO_GLYPHS\}\}/g, logoGlyphs)
    .replace(/\{\{SOCIALS\}\}/g, socials)
    .replace(/\{\{TOC\}\}/g, toc)
    .replace(/\{\{BODY\}\}/g, body)
    .replace(/\{\{META_DESC\}\}/g, esc(p.desc))
    .replace(/\{\{UPDATED\}\}/g, esc(UPDATED))
    .replace(/\{\{TITLE\}\}/g, esc(p.title))
    .replace(/\{\{SLUG\}\}/g, p.slug);

  const left = html.match(/\{\{[A-Z_]+\}\}/g);
  if (left) throw new Error('unreplaced tokens in ' + p.slug + ': ' + [...new Set(left)].join(', '));
  if (/CONTACT_EMAIL|GOVERNING_STATE/.test(html)) throw new Error('placeholder left in ' + p.slug);

  const dir = path.join(OUT, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`  /${p.slug}/index.html  ${(html.length / 1024).toFixed(1)} KB  ${toc.split('</li>').length - 1} sections`);
}
console.log(`built ${PAGES.length} legal pages`);
