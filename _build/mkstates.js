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
const adoptionData = JSON.parse(read('heatpump-adoption-by-state.json'));
const siteConfig = JSON.parse(read('site.config.json'));
const climateData = JSON.parse(read('climate-normals.json'));

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

  // Climate comes from the NOAA dataset unless the entry overrides it.
  const C = climateData[s.name] || {};
  const refCity = s.refCity || C.refCity;
  const janLow = s.janLow != null ? s.janLow : C.janLow;
  const julHigh = s.julHigh != null ? s.julHigh : C.julHigh;
  const climateSource = s.climateSource || 'NOAA 1991\u20132020 normals';

  // A note about holding output below zero is meaningless in Miami, where sizing
  // is driven by the cooling load. Pick the note that matches the actual climate.
  const coldNote = s.coldNote !== undefined ? s.coldNote
    : janLow == null ? ''
    : janLow < 15 ? `Winters here are genuinely severe, and that is the whole ballgame. A cold-climate heat pump is rated to hold useful output well below zero, but the rating only matters if the unit was picked for it. Ask any installer what happens on the coldest night of the year, and what the backup is when it arrives.`
    : janLow < 30 ? `Cold-climate heat pumps are rated to hold full output well below zero. The question here is not whether one works, it is whether yours was sized and installed for the coldest night of the year rather than the average one.`
    : janLow < 45 ? `Both loads matter here — cold snaps are real, and so are the summers. A system sized only for heating will short-cycle in August; one sized only for cooling will lean on backup heat in January. Getting the balance right is the job.`
    : `Cooling is the load that sizes the system here, and heating is the easy part — a heat pump covers it without breaking a sweat. The efficiency question is mostly about how hard the unit works in August, not January.`;

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

  // Adoption moved to the hero bar, so it is deliberately absent here.
  const figures = [
    figure(janLow, '°F', 'Coldest month average low', `${refCity} · ${climateSource}`),
    figure(julHigh, '°F', 'Warmest month average high', `${refCity} · ${climateSource}`),
    figure(s.designTemp, '°F', 'Winter design temperature', 'ASHRAE 99% · sizing basis'),
  ].filter(Boolean).join('\n        ');

  // Adoption wording is generated from heatpump-adoption-by-state.json so all 51
  // read identically. Anything set explicitly on the state entry wins.
  const A = adoptionData[s.name] || {};
  const share = s.hpShare != null ? Number(s.hpShare) : A.primary;
  const label = s.hpShareLabel
    || `of ${s.name} homes use a heat pump as their main heat`;
  let note = s.hpShareNote;
  if (note === undefined) {
    note = "Central heat pumps and ductless mini-splits combined, counted as the home's main heating equipment.";
    // Second sentence only where enough homes actually run a mini-split alongside
    // something else; below half a point it is noise, not a finding.
    if (A.gap != null && A.gap >= 0.5) {
      const f = A.companionFuels || [];
      const beside = f.length === 2 ? `${f[0]} or ${f[1]}` : f.length === 1 ? f[0] : 'another system';
      note += ` A further ${A.gap}% of ${s.name} homes run a mini-split as secondary heat alongside ${beside}.`;
    }
    // Only Alaska and Hawaii land here: barely any surveyed homes, so say so
    // rather than presenting a shaky number as if it were firm.
    if (A.rse != null && A.rse > 25) {
      note += ' The survey reached few homes in this state, so treat this figure as approximate.';
    }
  }

  // Hero adoption bar. Omitted entirely where there is no usable figure - an empty
  // bar would read as "zero", which is not the same as "not measured".
  let adoption = '';
  if (share != null) {
    const pct = Number(share);
    const SRC_URL = s.hpShareUrl || 'https://www.eia.gov/consumption/residential/data/2020/index.php?view=microdata';
    const SRC_NAME = 'EIA RECS 2020 microdata';
    const src = SRC_URL
      ? `<a class="adopt-src" href="${esc(SRC_URL)}" target="_blank" rel="noopener">${esc(s.hpShareSource || SRC_NAME)} &#8599;</a>`
      : `<span class="adopt-src">${esc(s.hpShareSource || '')}</span>`;
    adoption = `
    <div class="wrap adopt">
      <div class="adopt-head">
        <p class="eyebrow">Heat pump adoption</p>
        ${src}
      </div>
      <div class="adopt-bar" role="img" aria-label="${pct}% of homes in ${esc(s.name)} heat with a heat pump; ${100 - pct}% do not.">
        <div class="adopt-fill" style="width:${pct}%"></div>
        <span class="adopt-tick" style="left:25%"></span>
        <span class="adopt-tick" style="left:50%"></span>
        <span class="adopt-tick" style="left:75%"></span>
      </div>
      <div class="adopt-foot">
        <p class="adopt-num"><b>${pct}%</b> ${esc(label)}</p>
        <p class="adopt-goal">Goal: every home</p>
      </div>
      ${note ? `<p class="adopt-note">${esc(note)}</p>` : ''}
    </div>
`;
  }

  // Appended to every state unless the entry sets federalRebates:false. Worded so
  // it stays true everywhere: some states are open, some have burned through their
  // allocation, and a few have not launched. Asserting "live" per state would rot.
  const FEDERAL_REBATES = {
    name: 'Federal Home Energy Rebates',
    note: `The IRA rebate programs (HEAR and HOMES) survived the 2025 tax changes — they were grants to states, not tax credits. Each state runs its own, and they are at different stages: some open, some already out of money, some yet to launch. Check where ${s.name} stands before you count on it.`,
    url: 'https://www.energy.gov/scep/home-energy-rebates-programs',
  };
  const incentiveList = (s.incentives || []).concat(s.federalRebates === false ? [] : [FEDERAL_REBATES]);

  const incentives = incentiveList.map((i) =>
    '<li class="inc-row">'
    + `<h3 class="inc-n">${esc(i.name)}</h3>`
    + `<p class="inc-d">${esc(i.note)}</p>`
    + (i.url ? `<a class="inc-l" href="${esc(i.url)}" target="_blank" rel="noopener">Program details →</a>` : '')
    + '</li>'
  ).join('\n        ');

  // National, so it lives here rather than being repeated in all 51 state entries.
  // The One Big Beautiful Bill Act (PL 119-21 s.70505) killed 25C and 25D for
  // property placed in service after 31 Dec 2025. Plenty of homeowners still
  // believe the credit exists, so say plainly that it does not.
  const incNote = s.incentivesNote !== undefined ? s.incentivesNote : (
    '<p class="inc-note">The federal 25C tax credit — 30% back, up to $2,000 on a heat pump — '
    + 'ended for systems placed in service after 31 December 2025. If you had one installed in 2025 '
    + 'or earlier you can still claim it; there is no successor credit. '
    + 'Incentives move fast, so check <a href="https://www.dsireusa.org/" target="_blank" rel="noopener">DSIRE</a> '
    + 'for what is current in ' + esc(s.name) + '. Last checked September 2026.</p>'
  );

  const metaDesc = `Heat pump episodes, climate figures and rebate programs for ${s.name}. ${refCity} winters average ${janLow}°F lows.`;

  const html = tpl
    .replace(/\{\{LOGO_GLYPHS\}\}/g, logoGlyphs)
    .replace(/\{\{SOCIALS\}\}/g, socials)
    .replace(/\{\{SHAPE_VIEWBOX\}\}/g, vb)
    .replace(/\{\{SHAPE_PATH\}\}/g, shape.d)
    .replace(/\{\{FIGURES\}\}/g, figures)
    .replace(/\{\{ADOPTION\}\}/g, adoption)
    .replace(/\{\{INCENTIVES\}\}/g, incentives)
    .replace(/\{\{INCENTIVES_NOTE\}\}/g, incNote)
    .replace(/\{\{EP_MATCH\}\}/g, esc(JSON.stringify(s.episodes || [])))
    .replace(/\{\{META_DESC\}\}/g, esc(metaDesc))
    .replace(/\{\{INTRO\}\}/g, esc(s.intro))
    .replace(/\{\{COLD_NOTE\}\}/g, esc(coldNote))
    .replace(/\{\{JAN_LOW\}\}/g, esc(janLow))
    .replace(/\{\{JUL_HIGH\}\}/g, esc(julHigh))
    .replace(/\{\{CONTACT_EMAIL\}\}/g, esc(siteConfig.contactEmail))
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
