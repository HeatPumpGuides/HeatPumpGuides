// Build the listener contact page at ../apply/ from apply.template.html + apply.embed.html
const fs = require('fs');
const path = require('path');

const here = __dirname;
const OUT = path.join(here, '..');
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');

// Google tag, shared by every generator so the pages cannot drift apart.
const analytics = read('analytics.html').trim();

const cfg = JSON.parse(read('site.config.json'));
const tpl = read('apply.template.html');
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

// The GHL embed is pasted verbatim into apply.embed.html; the instructions
// comment at the top is stripped so it never ships.
const embed = read('apply.embed.html').replace(/<!--[\s\S]*?-->/g, '').trim();
const PLACEHOLDER = `<div class="apply-empty">
          <p class="eyebrow">Form</p>
          <p>The contact form will appear here. Paste the Go High Level embed code into <code>_build/apply.embed.html</code> and run <code>node _build/mkapply.js</code>.</p>
        </div>`;

const html = tpl
  .replace(/\{\{ANALYTICS\}\}/g, analytics)
  .replace(/\{\{LOGO_GLYPHS\}\}/g, logoGlyphs)
  .replace(/\{\{SOCIALS\}\}/g, socials)
  .replace(/\{\{META_DESC\}\}/g, esc('Listen to Heat Pump Guides and want to talk to us? Send your details and a short message and we will get back to you.'))
  .replace(/\{\{CONTACT_EMAIL\}\}/g, esc(cfg.contactEmail))
  .replace(/\{\{EMBED\}\}/g, () => '\n        ' + (embed || PLACEHOLDER) + '\n      ');

const left = html.match(/\{\{[A-Z_]+\}\}/g);
if (left) throw new Error('unreplaced tokens in apply: ' + [...new Set(left)].join(', '));

const dir = path.join(OUT, 'apply');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log(`  /apply/index.html  ${(html.length / 1024).toFixed(1)} KB  ${embed ? 'with form embed' : 'PLACEHOLDER — no embed pasted yet'}`);
