# Heat Pump Guides — website

Static site. No framework, no build step to *serve* it — `index.html`, `styles.css`,
`script.js`, `state.js`, `assets/`, and one folder per page. Upload it anywhere.

**Start here if you are picking this up cold.** Then read `_build/README.md` for the
build system and `DEPLOY.md` for the repo and hosting setup.

## What exists

| | |
|---|---|
| Homepage | Hero with an animated heat pump diagram, live podcast episodes, clickable US map |
| State pages | **51** — all 50 states plus DC, at `/maine`, `/texas`, … |
| Legal | `/privacy`, `/terms` |
| Apply | `/apply` — listener contact form, a Go High Level embed. Paste the embed into `_build/apply.embed.html`, run `node _build/mkapply.js`. The form's own dark styling lives in GHL (Custom CSS); the source copy is `_build/apply.ghl-custom.css` |
| Episodes | Pulled live from the RSS feed in the browser; no server needed |

## Preview it

```bash
cd "path/to/redesign"
python3 -m http.server 8765
```

Then open <http://localhost:8765/>. **Use the server, not `file://`** — opening the
HTML directly breaks the map links, the favicon and the RSS fetch, because the site
uses absolute paths.

## How it fits together

- **Pages are generated.** `index.html` and the 51 state pages are built by scripts in
  `_build/` from templates plus data files. Editing the built HTML directly works
  until the next build overwrites it — edit the template instead.
- **`styles.css`, `script.js` and `state.js` are hand-written.** Edit them directly;
  no build step.
- **Adding or changing a state** means editing `_build/states.data.json` and running
  `node _build/mkstates.js`. Each state entry is small: intro copy and incentives.
  Climate, adoption figures and the map outline are all looked up automatically.

## Analytics

Google Analytics (`G-Y7Q45XVCNG`) is on every page. The tag is defined once in
`_build/analytics.html` and injected by the generators — see `_build/README.md`.

## Where the numbers come from

Every figure on the site is sourced, and each dataset carries a `_method` block
explaining how it was derived and what its limits are.

- **Adoption** — `_build/heatpump-adoption-by-state.json`. Computed from EIA RECS 2020
  microdata, *not* their published state table: that table counts central heat pumps
  only and omits mini-splits, which badly undercounts the Northeast. Validated against
  EIA's published national figure. Next refresh spring 2027 — procedure in
  `_build/README.md`.
- **Climate** — `_build/climate-normals.json`. NOAA 1991-2020 normals for the largest
  metro in each state.

## Open items

1. **`governingState`** in `_build/site.config.json` is set to `Massachusetts` as a
   placeholder for the Terms' governing-law clause. Should be the state of
   incorporation. **Confirm before relying on the Terms.**
2. **YouTube link** in the footer is `https://youtube.com` — a placeholder inherited
   from the old site. Needs the real channel URL. Set it in `_build/build.js`,
   `_build/mkstates.js` and `_build/mklegal.js` (the `SOCIALS` array in each).
3. **`designTemp` is `null` for all 51 states.** ASHRAE 99% winter design temperature
   is the number that actually governs heat pump sizing, but it is not freely
   available. The stat is omitted rather than guessed; fill it in per state and it
   appears automatically.
4. **Episode tagging.** Every state shows placeholder episode slots. To attach real
   episodes, put a guid or a distinctive title fragment in that state's `episodes`
   array — the page matches against the live feed on load, no rebuild needed.
5. **Minnesota's incentive link** is the one URL never verified — the state site sits
   behind a CAPTCHA that blocks automated checks. Worth clicking once.
6. **Git.** The first upload was done through GitHub's web UI. Switching to `git push`
   is worth it — the web uploader silently skips dotfiles like `.nojekyll`.
   `DEPLOY.md` §4 has the setup.

## Things that will bite you

- **The site must be served from a domain root.** Internal links are absolute
  (`/maine`, `/#states`). At `username.github.io/repo/` they all 404. Use a custom
  domain, or name the repo `<username>.github.io`.
- **State pages are folders, not files.** `maine/index.html` serves at `/maine`, which
  is what the map links to. `maine.html` would serve at `/maine.html` and 404.
- **`.nojekyll` must stay in the repo root.** Without it GitHub Pages runs the site
  through Jekyll, which mangles files starting with `_`.
- **HTTP 200 does not mean a link is good.** Two incentive URLs returned 200 while
  being a real-estate lead-gen site and a dead deep link. Open links in a browser
  before shipping them. Conversely, several legitimate government and utility sites
  return 403 to `curl` because of bot protection — that is not a broken link.
- **Incentive programmes change fast.** The federal 25C credit was repealed effective
  31 Dec 2025 and the site says so. Several states' federal rebate programmes had not
  launched as of late 2026. Re-check before trusting any of it.
