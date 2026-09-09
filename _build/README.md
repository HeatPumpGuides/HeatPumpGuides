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
| `mklegal.js` | Builds `../privacy/` and `../terms/` from `legal/*.html` | editing the legal pages |

Order if you regenerate everything: `mkmap.js` → `mkmapsvg.js` → `mkstripes.js` → `build.js` → `mkstates.js` → `mklegal.js`.

## Legal pages

Prose lives in `legal/privacy.html` and `legal/terms.html` — body content only,
no page furniture. `mklegal.js` wraps them in the shared shell and builds the
table of contents automatically from the `<h2 id="...">` headings, so the contents
list can never drift from the body. Add or rename a heading and the nav follows.

**Two placeholders are set at the top of `mklegal.js` and must be confirmed before
you publish:** `CONTACT_EMAIL` and `GOVERNING_STATE`. `UPDATED` is the date shown
on both pages — bump it whenever you change the text.

`mkmap.js` takes a `TOL` env var (default `0.5`) controlling how aggressively the
coastlines are simplified. Higher = smaller file, blockier shapes. Simplification
runs on shared *arcs*, not per-state rings, so neighbouring borders stay seam-free.

## Refreshing the adoption data (spring 2027)

`heatpump-adoption-by-state.json` is built from the **RECS 2020** microdata. That is
the newest 50-state source for heat pump share and stays so until **spring 2027**,
when EIA publishes the 2024 space heating tables and microdata.

Checked September 2026: the 2024 preliminary microdata is already out
(`recs2024_public_v1.csv`, 462 columns) and does carry `state_postal`, `NWEIGHT` and
all 60 replicate weights — but **not** `EQUIPM`, `EQUIPAUXTYPE`, `FUELHEAT` or
`HEATHOME`. The space heating block is simply not in that release, so the figure
cannot be pulled forward.

When the 2024 space heating data lands, the refresh is mechanical:

1. Download the then-current public microdata from
   <https://www.eia.gov/consumption/residential/data/2024/index.php?view=microdata>
2. Confirm in that year's codebook that `EQUIPM` still uses **4 = central heat pump**
   and **13 = ductless mini-split**, and that `EQUIPAUXTYPE` still uses 13. Do not
   assume — the codes are what make the number mean anything.
3. Re-run the same computation: `EQUIPM in {4,13}` weighted by `NWEIGHT`, denominator
   all occupied homes; `any` adds `EQUIPAUXTYPE == 13`; RSE from the 60 replicate
   weights with Fay rho = 0.5.
4. **Validate before shipping**: the weighted household total must match EIA's
   published total, and the national heat pump share must match their published
   national figure. Both checks passed on the 2020 data (123.53M households, 13.9%
   against a published 14%) and will catch a bad parse.
5. Overwrite `heatpump-adoption-by-state.json`, bump the year in the source label
   (`mkstates.js` → `SRC_NAME`) and the URL, then `node mkstates.js`.

Nothing else changes — the wording, the bar, and the secondary-heat sentence are all
generated from that one file.

### Why not something fresher in the meantime

- **Census ACS** is annual, but classifies by *fuel*, not equipment — heat pumps and
  electric baseboard resistance both count as "electricity". Useless for this metric,
  and actively misleading in states like Maine.
- **State programme data** (Efficiency Maine, Mass Save) is current to the quarter but
  uses a different methodology in every state. Fine as a supporting stat on an
  individual page; not comparable across 51.

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
