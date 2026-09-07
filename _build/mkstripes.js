// Build warming-stripe colours from NASA GISTEMP annual (J-D) anomalies.
const fs = require('fs');

const rows = fs.readFileSync('gistemp.csv', 'utf8').trim().split('\n');
const header = rows[1].split(',');
const yearIdx = header.indexOf('Year');
const jdIdx = header.indexOf('J-D');

const series = [];
for (const line of rows.slice(2)) {
  const c = line.split(',');
  const year = Number(c[yearIdx]);
  const v = c[jdIdx];
  if (!v || v.includes('*')) continue; // partial year
  series.push([year, Number(v)]);
}

// ColorBrewer RdBu, cold -> hot. Ed Hawkins' stripes use this diverging ramp.
const RAMP = [
  '#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0',
  '#f7f7f7',
  '#fddbc7', '#f4a582', '#d6604d', '#b2182b', '#67001f',
];

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const RGB = RAMP.map(hex2rgb);

function ramp(t) { // t in [0,1]
  const x = Math.min(1, Math.max(0, t)) * (RGB.length - 1);
  const i = Math.min(RGB.length - 2, Math.floor(x));
  const f = x - i;
  return rgb2hex(RGB[i].map((v, k) => v + (RGB[i + 1][k] - v) * f));
}

// Centre on the 20th-century mean, the convention for this graphic.
const base = series.filter(([y]) => y >= 1901 && y <= 2000);
const centre = base.reduce((s, [, v]) => s + v, 0) / base.length;
// Hawkins scales the ramp to +/-2.6 standard deviations of the reference period,
// which is what saturates the early blues and pins recent years at deep red.
const sd = Math.sqrt(base.reduce((s, [, v]) => s + (v - centre) ** 2, 0) / base.length);
const half = 2.6 * sd;

const colors = series.map(([, v]) => ramp((v - centre) / half / 2 + 0.5));

// Emit as a hard-stop linear-gradient: one CSS declaration, scales to any width.
const n = colors.length;
const stops = colors.map((c, i) => {
  const a = ((i / n) * 100).toFixed(3);
  const b = (((i + 1) / n) * 100).toFixed(3);
  return `${c} ${a}% ${b}%`;
}).join(',');

fs.writeFileSync('stripes.css.txt', `linear-gradient(90deg,${stops})`);
console.log('years:', series[0][0], '-', series[n - 1][0], '| count:', n);
console.log('centre:', centre.toFixed(3), 'half-range:', half.toFixed(3));
console.log('gradient bytes:', stops.length);
console.log('first/mid/last:', colors[0], colors[n >> 1], colors[n - 1]);
