// Rebuild climate-normals.json from NOAA/NCEI 1991-2020 Monthly Climate Normals.
//
// You should rarely need this — NOAA reissues normals once a decade. Run it if you
// want to change a reference city, or after the next normals release.
//
//   node mkclimate.js
//
// No API key required. Downloads the ~11MB GHCN station inventory to a temp file
// on first run rather than committing it to the repo.
const fs = require('fs');
const os = require('os');
const path = require('path');

const OUT = path.join(__dirname, 'climate-normals.json');
const INVENTORY = path.join(os.tmpdir(), 'ghcnd-stations.txt');
const INVENTORY_URL = 'https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt';
const API = 'https://www.ncei.noaa.gov/access/services/data/v1';

// Largest metro per state — where the housing stock is. Coordinates are the city
// centre; the nearest station with usable normals is chosen from there.
const METROS = {
  AL:['Alabama','Birmingham',33.52,-86.80],       AK:['Alaska','Anchorage',61.22,-149.90],
  AZ:['Arizona','Phoenix',33.45,-112.07],         AR:['Arkansas','Little Rock',34.75,-92.29],
  CA:['California','Los Angeles',34.05,-118.24],  CO:['Colorado','Denver',39.74,-104.99],
  CT:['Connecticut','Hartford',41.76,-72.69],     DE:['Delaware','Wilmington',39.74,-75.55],
  DC:['District of Columbia','Washington',38.90,-77.04], FL:['Florida','Miami',25.76,-80.19],
  GA:['Georgia','Atlanta',33.75,-84.39],          HI:['Hawaii','Honolulu',21.31,-157.86],
  ID:['Idaho','Boise',43.62,-116.20],             IL:['Illinois','Chicago',41.88,-87.63],
  IN:['Indiana','Indianapolis',39.77,-86.16],     IA:['Iowa','Des Moines',41.59,-93.62],
  KS:['Kansas','Wichita',37.69,-97.34],           KY:['Kentucky','Louisville',38.25,-85.76],
  LA:['Louisiana','New Orleans',29.95,-90.07],    ME:['Maine','Portland',43.66,-70.26],
  MD:['Maryland','Baltimore',39.29,-76.61],       MA:['Massachusetts','Boston',42.36,-71.06],
  MI:['Michigan','Detroit',42.33,-83.05],         MN:['Minnesota','Minneapolis',44.98,-93.27],
  MS:['Mississippi','Jackson',32.30,-90.18],      MO:['Missouri','St. Louis',38.63,-90.20],
  MT:['Montana','Billings',45.78,-108.50],        NE:['Nebraska','Omaha',41.26,-95.93],
  NV:['Nevada','Las Vegas',36.17,-115.14],        NH:['New Hampshire','Manchester',42.99,-71.46],
  NJ:['New Jersey','Newark',40.74,-74.17],        NM:['New Mexico','Albuquerque',35.08,-106.65],
  NY:['New York','New York',40.71,-74.01],        NC:['North Carolina','Charlotte',35.23,-80.84],
  ND:['North Dakota','Fargo',46.88,-96.79],       OH:['Ohio','Columbus',39.96,-83.00],
  OK:['Oklahoma','Oklahoma City',35.47,-97.52],   OR:['Oregon','Portland',45.52,-122.68],
  PA:['Pennsylvania','Philadelphia',39.95,-75.17],RI:['Rhode Island','Providence',41.82,-71.41],
  SC:['South Carolina','Columbia',34.00,-81.03],  SD:['South Dakota','Sioux Falls',43.55,-96.73],
  TN:['Tennessee','Nashville',36.16,-86.78],      TX:['Texas','Houston',29.76,-95.37],
  UT:['Utah','Salt Lake City',40.76,-111.89],     VT:['Vermont','Burlington',44.48,-73.21],
  VA:['Virginia','Richmond',37.54,-77.44],        WA:['Washington','Seattle',47.61,-122.33],
  WV:['West Virginia','Charleston',38.35,-81.63], WI:['Wisconsin','Milwaukee',43.04,-87.91],
  WY:['Wyoming','Cheyenne',41.14,-104.82],
};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const km = (a, b, c, d) => {
  const p = Math.PI / 180;
  return 12742 * Math.asin(Math.sqrt(0.5 - Math.cos((c-a)*p)/2 + Math.cos(a*p)*Math.cos(c*p)*(1-Math.cos((d-b)*p))/2));
};

async function main() {
  if (!fs.existsSync(INVENTORY)) {
    process.stdout.write('downloading GHCN station inventory... ');
    const r = await fetch(INVENTORY_URL);
    if (!r.ok) throw new Error('inventory download failed: ' + r.status);
    fs.writeFileSync(INVENTORY, Buffer.from(await r.arrayBuffer()));
    console.log('done');
  }

  // fixed-width: id 0-11, lat 12-20, lon 21-30, name 41-71
  const all = [];
  for (const line of fs.readFileSync(INVENTORY, 'latin1').split('\n')) {
    const id = line.slice(0, 11).trim();
    if (!id.startsWith('USW000')) continue;
    const lat = parseFloat(line.slice(12, 20)), lon = parseFloat(line.slice(21, 30));
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    all.push({ id, name: line.slice(41, 71).trim(), lat, lon });
  }

  // DC's airports are filed under VA/MD, so search nationally by distance, not by
  // the station's state code.
  const shortlist = {};
  const ids = new Set();
  for (const [ab, [, city, lat, lon]] of Object.entries(METROS)) {
    const near = all
      .map((s) => ({ ...s, km: km(lat, lon, s.lat, s.lon) }))
      .filter((s) => s.km < 60)
      .sort((a, b) => a.km - b.km)
      .slice(0, 8);
    shortlist[ab] = near;
    near.forEach((s) => ids.add(s.id));
  }

  // Many nearby stations are discontinued and return nothing, so ask for all the
  // candidates and keep the closest one that answers with a full 12 months.
  const list = [...ids];
  const data = {};
  for (let i = 0; i < list.length; i += 40) {
    const batch = list.slice(i, i + 40);
    const qs = new URLSearchParams({
      dataset: 'normals-monthly-1991-2020',
      stations: batch.join(','),
      dataTypes: 'MLY-TMIN-NORMAL,MLY-TMAX-NORMAL',
      format: 'json',
    });
    const r = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) { console.warn('  batch failed', r.status); continue; }
    for (const rec of await r.json()) {
      const lo = parseFloat(rec['MLY-TMIN-NORMAL']), hi = parseFloat(rec['MLY-TMAX-NORMAL']);
      if (Number.isNaN(lo) || Number.isNaN(hi)) continue;
      (data[rec.STATION] ||= {})[rec.DATE] = { lo, hi };
    }
    console.log(`  normals ${Math.min(i + 40, list.length)}/${list.length}`);
  }

  const out = { _method: [
    'Coldest-month average low and warmest-month average high for one reference city',
    'per state, from the NOAA/NCEI 1991-2020 Monthly Climate Normals.',
    '',
    '  refCity     Largest metro in the state - where most of the housing stock is.',
    '              Named on the page, because one city cannot describe a whole state.',
    '  station     GHCN station actually used: the closest one to the metro centre',
    '              returning complete 12-month normals.',
    '  janLow      Average daily low of the COLDEST month (not always January -',
    '              12 states bottom out in December). Field name kept for compatibility.',
    '  julHigh     Average daily high of the WARMEST month (August in 9 states).',
    '',
    'Regenerate with: node mkclimate.js',
    `Source: ${API} (dataset=normals-monthly-1991-2020)`,
  ] };

  const named = Object.entries(METROS).sort((a, b) => a[1][0].localeCompare(b[1][0]));
  for (const [ab, [name, city]] of named) {
    const hit = shortlist[ab].find((s) => Object.keys(data[s.id] || {}).length === 12);
    if (!hit) throw new Error(`no station with complete normals near ${city}, ${ab}`);
    const m = data[hit.id];
    const cold = Object.keys(m).reduce((a, b) => (m[b].lo < m[a].lo ? b : a));
    const warm = Object.keys(m).reduce((a, b) => (m[b].hi > m[a].hi ? b : a));
    out[name] = {
      abbr: ab, refCity: city,
      janLow: Math.round(m[cold].lo), julHigh: Math.round(m[warm].hi),
      coldMonth: MONTHS[+cold - 1], warmMonth: MONTHS[+warm - 1],
      station: hit.id, stationName: hit.name, kmFromCity: Math.round(hit.km * 10) / 10,
    };
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`\nwrote climate-normals.json for ${Object.keys(out).length - 1} jurisdictions`);
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
