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
| `mkstates.js` | Builds all 51 state pages from `states.data.json` + the shared datasets | **every state edit** |
| `mkclimate.js` | Fetches NOAA 1991-2020 normals → `climate-normals.json` | rarely; normals reissue once a decade |
| `mklegal.js` | Builds `../privacy/` and `../terms/` from `legal/*.html` | editing the legal pages |
| `mkapply.js` | Builds `../apply/` from `apply.template.html` + the GHL form embed in `apply.embed.html` | changing the form or the page copy |
| `mkepisodes.js` | Fetches the RSS feed → `feed.xml`, `episodes.fallback.json`, and looks up each episode's Spotify / Apple / YouTube URL → `episode-links.json` | a new episode is out |
| `mkblog.js` | Builds `../blog/` (every post + the index + `posts.json`) from `blog/<slug>/`, plus `../sitemap.xml` and `../robots.txt`. `--check-links` also requests every external link | any post edit, and after adding a page anywhere on the site |

Day to day you only ever need two:

```
node _build/mkstates.js     # after editing states.data.json or state.template.html
node _build/build.js       # after editing index.template.html
```

Full regeneration order, only if rebuilding from scratch:
`mkmap.js` → `mkmapsvg.js` → `mkclimate.js` → `mkstripes.js` → `mkepisodes.js` → `build.js` → `mkstates.js` → `mklegal.js` → `mkapply.js` → `mkblog.js`.

## Blog posts

One folder per episode in `blog/`, named after the post's URL slug:

| File | What it holds |
|---|---|
| `post.json` | `guid` (the episode's RSS guid — ties the post to its audio, date and platform links), `slug`, `headline` (the h1), `subheading`, `seoTitle` (the `<title>`, ≤ 60 chars), `description` (meta, ≤ 155 chars), `published`, optional `updated`, `related` (up to 3 other slugs) |
| `article.html` | The article body. Starts at `<h2>` — the headline is the page's h1. Headings may not skip a level. |
| `transcript.txt` | One paragraph per line, `[m:ss] text`. The timestamps become buttons that play from that point. |
| `post.json` → `guest` | Interview episodes only: `{ name, jobTitle, company, url, areaServed }`. Added to the episode's structured data. What to write is in `EPISODE-BLOG-SOP.md`. |

`mkblog.js` refuses to build a post that would ship broken, and names the problem:
an `<h1>` in the body, a skipped heading level, an internal link to a page that
doesn't exist (always link the trailing-slash form, `/maine/`), a link with
tracking parameters (`utm_*`, `srsltid`, …), vague anchor text ("click here"), or a
`related` slug with no post. External links get `target="_blank" rel="noopener"`
added automatically.

Styling hooks inside `article.html`:

- `<p class="post-intro">` — the opening paragraph, set larger
- `<div class="keybox">` — the "short answer" box
- `<div class="table-wrap"><table>…` — data tables; `class="num"` right-aligns a column
- `<aside class="ed-note"><p class="ed-note-h">Editor's note · Month YYYY</p><p>…</p></aside>` —
  for anything the episode said that has since changed. Put it right after the claim.

**Adding a post by hand:** `node _build/mkepisodes.js` (picks up the new episode and
its platform links) → create `blog/<slug>/` → `node _build/mkblog.js --check-links`
→ `node _build/build.js` (so the homepage's baked links include it; the live page
also picks it up from `/blog/posts.json` without a rebuild).

## Google Analytics

The Google tag (property `G-Y7Q45XVCNG`) lives in `analytics.html` and nowhere else.
All five page generators read that file and drop it in immediately after `<head>`,
so every page carries exactly one copy and they cannot drift apart.

To change the property ID, edit `analytics.html` and rebuild all five:

```
node _build/build.js && node _build/mkstates.js && node _build/mklegal.js && node _build/mkapply.js && node _build/mkblog.js
```

Never paste a second tag into a page — Google counts the pageview twice.

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

To refresh the baked episodes, and look up per-episode platform links:

```
node _build/mkepisodes.js
```

Links already in `episode-links.json` are never overwritten, so a hand fix sticks.
Spotify and YouTube can take a few hours to list a new episode; re-run to fill gaps.

## Preview locally

```
python3 -m http.server 8765
```

Then open `http://localhost:8765/`. Use a server rather than opening the file
directly — `file://` blocks the feed fetch.

## Old-URL redirect stubs

`privacy-policy.html`, `terms-of-service.html`, `savings-calculator.html`, `blog-home.html` and `about.html` at the site root are hand-written meta-refresh + canonical stubs for URLs from the old Webflow site (GitHub Pages can't do server 301s). GitHub Pages serves them at both `/name` and `/name.html`. They aren't generated and aren't in the sitemap — leave them alone.

Internal links always use the trailing-slash form (`/vermont/`, `/privacy/`); the slashless form is a 301 on GitHub Pages and shows up in Search Console as "Page with redirect".
