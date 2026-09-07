# Build sources

The published site is the four things one level up — `index.html`, `styles.css`,
`script.js`, `assets/`. They are plain static files: upload them anywhere, no
build step required to *serve* them.

This folder only matters when you want to **change** the page, because
`index.html` has ~90 KB of generated US-map SVG baked into it and is not
pleasant to hand-edit.

## Editing the page

Edit `index.template.html` (the readable version, with `{{TOKENS}}` where
generated content goes), then:

```
node _build/build.js
```

That rewrites `../index.html` and patches the warming-stripes gradient into
`../styles.css`.

`styles.css` and `script.js` are **not** generated — edit those directly.

## What each script does

| Script | Purpose | Run when |
|---|---|---|
| `build.js` | Assembles `index.html` from the template + generated pieces | every page edit |
| `mkmap.js` | Decodes `p.json` (us-atlas TopoJSON, pre-projected Albers USA) into simplified state paths → `states.out.json` | only to change map detail |
| `mkmapsvg.js` | Turns `states.out.json` into the map SVG → `map.fragment.html` | to change labels/callouts |
| `mkstripes.js` | Turns `gistemp.csv` into the stripes CSS gradient → `stripes.css.txt` | to refresh temperature data |

Order if you regenerate everything: `mkmap.js` → `mkmapsvg.js` → `mkstripes.js` → `build.js`.

`mkmap.js` takes a `TOL` env var (default `0.5`) controlling how aggressively the
coastlines are simplified. Higher = smaller file, blockier shapes. Simplification
runs on shared *arcs*, not per-state rings, so neighbouring borders stay seam-free.

## Data sources

- **Map** — `p.json`, from `https://cdn.jsdelivr.net/npm/us-atlas@2/us/10m.json`.
  Already projected to Albers USA in a 975×610 box, so no projection maths needed.
- **Warming stripes** — `gistemp.csv`, NASA GISTEMP v4 land-ocean global means:
  `https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv`.
  Colours use the ColorBrewer RdBu ramp scaled to ±2.6σ of the 1901–2000 mean,
  which is the convention Ed Hawkins' original graphic uses. Re-download the CSV
  and re-run `mkstripes.js` to add new years.
- **Episodes** — `episodes.fallback.json`, baked from `feed.xml` so the page
  paints instantly and still shows something if the feed is unreachable. The
  live feed is fetched in the browser on every load and replaces it.
  Feed: `https://anchor.fm/s/f8c1cc3c/podcast/rss`
- **Social icons** — simple-icons (CC0).

To refresh the baked episodes:

```
curl -sL https://anchor.fm/s/f8c1cc3c/podcast/rss -o _build/feed.xml
```

then re-derive `episodes.fallback.json` (see the inline snippet in the session
notes, or just leave it — the live fetch keeps the page current regardless).

## Preview locally

```
python3 -m http.server 8765
```

Then open `http://localhost:8765/`. Use a server rather than opening the file
directly — `file://` blocks the feed fetch.
