// Turn the decoded state paths into the SVG fragment that goes in the page.
const fs = require('fs');
const states = require('./states.out.json');

// --- label placement -------------------------------------------------------
// A bounding-box centre lands in Lake Michigan for MI and offshore for FL/LA,
// so find the interior point furthest from any edge (pole of inaccessibility).
function ringsOf(d) {
  return d.split('Z').filter(Boolean).map((seg) => {
    const nums = seg.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const pts = [];
    for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    return pts;
  });
}

function area(r) {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

function inside(p, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function distToRing(p, ring) {
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j], [x2, y2] = ring[i];
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((p[0] - x1) * dx + (p[1] - y1) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    min = Math.min(min, Math.hypot(p[0] - (x1 + t * dx), p[1] - (y1 + t * dy)));
  }
  return min;
}

function pole(d) {
  const ring = ringsOf(d).sort((a, b) => area(b) - area(a))[0];
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  let lo = [Math.min(...xs), Math.min(...ys)], hi = [Math.max(...xs), Math.max(...ys)];
  let best = null, bestD = -1;
  for (let pass = 0; pass < 3; pass++) {
    const N = 24;
    const sx = (hi[0] - lo[0]) / N, sy = (hi[1] - lo[1]) / N;
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const p = [lo[0] + i * sx, lo[1] + j * sy];
        if (!inside(p, ring)) continue;
        const dd = distToRing(p, ring);
        if (dd > bestD) { bestD = dd; best = p; }
      }
    }
    if (!best) break;
    lo = [best[0] - sx, best[1] - sy];
    hi = [best[0] + sx, best[1] + sy];
  }
  return best ? { x: Math.round(best[0] * 10) / 10, y: Math.round(best[1] * 10) / 10, r: bestD } : null;
}

// --- callout column --------------------------------------------------------
// The crowded northeast gets a labelled column instead of unhittable shapes.
const CALLOUT = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC'];
const byAbbr = Object.fromEntries(states.map((s) => [s.abbr, s]));
const ordered = CALLOUT.slice().sort((a, b) => byAbbr[a].cy - byAbbr[b].cy);

const COL_X = 986;
const CHIP_W = 124;   // wide enough for "New Hampshire" at 11px
const START_Y = 120;
const STEP = 31;
const VIEW_W = COL_X + CHIP_W + 14;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slugOf = (s) => s.slug;

let paths = '', labels = '', callouts = '';

for (const s of states) {
  const href = '/' + slugOf(s);
  paths += `<a class="st" href="${href}" data-st="${s.abbr}" aria-label="Heat pump episodes in ${esc(s.name)}">`
    + `<title>${esc(s.name)}</title><path d="${s.d}"/></a>`;

  if (CALLOUT.includes(s.abbr)) continue;
  // The Hawaiian islands are too slender to hold a label; sit it off the chain.
  if (s.abbr === 'HI') {
    labels += `<text class="st-abbr st-abbr-off" x="${s.cx + s.w / 2 + 16}" y="${s.cy + 4}" data-st="HI">HI</text>`;
    continue;
  }
  const p = pole(s.d);
  // Only label where the abbreviation actually fits inside the shape.
  if (p && p.r > 11) {
    labels += `<text class="st-abbr" x="${p.x}" y="${p.y}" data-st="${s.abbr}">${s.abbr}</text>`;
  }
}

ordered.forEach((abbr, i) => {
  const s = byAbbr[abbr];
  const y = START_Y + i * STEP;
  callouts += `<g class="st-callout" data-st="${abbr}">`
    + `<line class="st-leader" x1="${s.cx}" y1="${s.cy}" x2="${COL_X - 8}" y2="${y}"/>`
    + `<circle class="st-dot" cx="${s.cx}" cy="${s.cy}" r="2.4"/>`
    + `<a href="/${slugOf(s)}" aria-label="Heat pump episodes in ${esc(s.name)}">`
    + `<rect class="st-chip" x="${COL_X}" y="${y - 11.5}" width="${CHIP_W}" height="23" rx="4"/>`
    + `<text class="st-chip-t" x="${COL_X + 10}" y="${y}">${abbr}</text>`
    + `<text class="st-chip-n" x="${COL_X + 34}" y="${y}">${esc(s.name === 'District of Columbia' ? 'Washington DC' : s.name)}</text>`
    + `</a></g>`;
});

const svg = `<svg class="usmap" viewBox="0 0 ${VIEW_W} 620" role="group" aria-label="Map of the United States. Choose a state.">`
  + `<g class="map-shapes">${paths}</g>`
  + `<g class="map-abbrs" aria-hidden="true">${labels}</g>`
  + `<g class="map-callouts">${callouts}</g>`
  + `</svg>`;

fs.writeFileSync('map.fragment.html', svg);
console.log('bytes:', svg.length, '| in-map labels:', (labels.match(/<text/g) || []).length, '| callouts:', ordered.length);
console.log('order:', ordered.join(' '));
