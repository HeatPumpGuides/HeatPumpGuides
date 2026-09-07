// Decode the pre-projected us-atlas TopoJSON into SVG path data, one path per state.
const fs = require('fs');
const topo = require('./p.json');

const FIPS = {
  '01': ['Alabama', 'AL'], '02': ['Alaska', 'AK'], '04': ['Arizona', 'AZ'], '05': ['Arkansas', 'AR'],
  '06': ['California', 'CA'], '08': ['Colorado', 'CO'], '09': ['Connecticut', 'CT'], '10': ['Delaware', 'DE'],
  '11': ['District of Columbia', 'DC'], '12': ['Florida', 'FL'], '13': ['Georgia', 'GA'], '15': ['Hawaii', 'HI'],
  '16': ['Idaho', 'ID'], '17': ['Illinois', 'IL'], '18': ['Indiana', 'IN'], '19': ['Iowa', 'IA'],
  '20': ['Kansas', 'KS'], '21': ['Kentucky', 'KY'], '22': ['Louisiana', 'LA'], '23': ['Maine', 'ME'],
  '24': ['Maryland', 'MD'], '25': ['Massachusetts', 'MA'], '26': ['Michigan', 'MI'], '27': ['Minnesota', 'MN'],
  '28': ['Mississippi', 'MS'], '29': ['Missouri', 'MO'], '30': ['Montana', 'MT'], '31': ['Nebraska', 'NE'],
  '32': ['Nevada', 'NV'], '33': ['New Hampshire', 'NH'], '34': ['New Jersey', 'NJ'], '35': ['New Mexico', 'NM'],
  '36': ['New York', 'NY'], '37': ['North Carolina', 'NC'], '38': ['North Dakota', 'ND'], '39': ['Ohio', 'OH'],
  '40': ['Oklahoma', 'OK'], '41': ['Oregon', 'OR'], '42': ['Pennsylvania', 'PA'], '44': ['Rhode Island', 'RI'],
  '45': ['South Carolina', 'SC'], '46': ['South Dakota', 'SD'], '47': ['Tennessee', 'TN'], '48': ['Texas', 'TX'],
  '49': ['Utah', 'UT'], '50': ['Vermont', 'VT'], '51': ['Virginia', 'VA'], '53': ['Washington', 'WA'],
  '54': ['West Virginia', 'WV'], '55': ['Wisconsin', 'WI'], '56': ['Wyoming', 'WY'],
};

const [sx, sy] = topo.transform.scale;
const [tx, ty] = topo.transform.translate;

// Arcs are delta-encoded and quantized; accumulate then de-quantize.
const rawArcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * sx + tx, y * sy + ty];
  });
});

// Douglas-Peucker. Applied per *arc* rather than per ring: arcs are shared between
// neighbouring states, so simplifying here keeps their common borders identical
// and the map seam-free.
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    if (hi - lo < 2) continue;
    const [ax, ay] = pts[lo], [bx, by] = pts[hi];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    let far = -1, best = tol;
    for (let i = lo + 1; i < hi; i++) {
      const [px, py] = pts[i];
      const d = len === 0
        ? Math.hypot(px - ax, py - ay)
        : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > best) { best = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([lo, far], [far, hi]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const TOL = Number(process.env.TOL || 0.5);
const arcs = rawArcs.map((a) => simplify(a, TOL));

const getArc = (i) => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);

function ringPoints(indices) {
  const pts = [];
  for (const i of indices) {
    const a = getArc(i);
    for (let k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]);
  }
  return pts;
}

const r = (n) => Math.round(n * 10) / 10;

// Drop rings too small to see at render size (tiny offshore islands) to keep the file lean.
function ringArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

function toPath(geom) {
  const polys = geom.type === 'Polygon' ? [geom.arcs] : geom.arcs;
  let d = '';
  for (const poly of polys) {
    for (const ringIdx of poly) {
      const pts = ringPoints(ringIdx);
      if (pts.length < 3) continue;
      if (ringArea(pts) < 0.6) continue;
      let seg = '';
      let px = null, py = null;
      for (let i = 0; i < pts.length; i++) {
        const x = r(pts[i][0]), y = r(pts[i][1]);
        if (x === px && y === py) continue; // collapse duplicates after rounding
        seg += (seg ? 'L' : 'M') + x + ' ' + y;
        px = x; py = y;
      }
      if (seg) d += seg + 'Z';
    }
  }
  return d;
}

const out = [];
for (const geom of topo.objects.states.geometries) {
  const meta = FIPS[geom.id];
  if (!meta) { console.error('unmapped FIPS', geom.id); continue; }
  const [name, abbr] = meta;
  const d = toPath(geom);
  if (!d) { console.error('empty path', name); continue; }
  // bbox centre, for placing the abbreviation label
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
  }
  out.push({
    abbr, name, d,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    cx: r((minX + maxX) / 2), cy: r((minY + maxY) / 2),
    w: r(maxX - minX), h: r(maxY - minY),
  });
}

out.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync('states.out.json', JSON.stringify(out));
console.log('states:', out.length);
console.log('total path bytes:', out.reduce((s, o) => s + o.d.length, 0));
console.log('largest:', out.map(o => [o.abbr, o.d.length]).sort((a, b) => b[1] - a[1]).slice(0, 5));
