# Publishing this site on GitHub Pages

## 1. The one rule that governs the folder structure

Every internal link on this site is **absolute** — the map links to `/massachusetts`,
the header links to `/`, the nav links to `/#states`.

That means **the contents of this folder must sit at the root of the repository**,
not inside a subfolder. If you push the whole `Website Design` folder and the site
ends up at `yoursite.com/redesign/`, every one of those links breaks.

So: the repo root *is* this `redesign` folder.

## 2. Why state pages are folders, not `.html` files

```
massachusetts/index.html     ->  served at /massachusetts     ✅
massachusetts.html           ->  served at /massachusetts.html ❌
```

The homepage map links to `/massachusetts`, with no extension. A web server
serves `<folder>/index.html` automatically when you request `<folder>`, so the
folder form is what matches those links. It also gives you clean URLs, which read
better and index better.

Do this for all 50. One folder per state, `index.html` inside it.

## 3. Target structure

```
your-repo/                     <- repo root = site root
├── .nojekyll                  <- tells Pages to serve files as-is
├── .gitignore
├── CNAME                      <- custom domain (delete if not using one)
├── index.html                 <- homepage
├── styles.css                 <- every page shares this
├── script.js                  <- homepage only
├── state.js                   <- state pages only
├── DEPLOY.md
├── assets/
│   ├── favicon.png
│   └── fonts/                 <- 6 .woff2 files, all self-hosted
├── massachusetts/
│   └── index.html
├── california/                <- add as you build them
│   └── index.html
└── _build/                    <- source + generators, not part of the site
    ├── README.md
    ├── build.js               <- rebuilds index.html
    ├── mkstates.js            <- rebuilds every state page
    ├── states.data.json       <- ⭐ the file you edit to add a state
    ├── state.template.html    <- the shared state page layout
    └── …
```

**`.nojekyll` matters.** GitHub Pages runs files through Jekyll by default, which
ignores anything starting with an underscore and tries to interpret `{{ }}` as
template syntax. Both would cause you grief here. The empty `.nojekyll` file
switches all of that off. Don't delete it.

`_build/` gets committed — it's the source of truth for the pages — and will be
publicly readable. That's fine; it holds no secrets, only generators and public data.

## 4. First-time setup

You have Homebrew but no `gh`, no SSH key, and no saved git credentials. The
GitHub CLI is the least painful path — it handles login *and* configures git's
credentials in one step.

```bash
brew install gh
gh auth login
```

Choose **GitHub.com → HTTPS → login with a web browser**, and say **yes** when it
offers to authenticate git with your GitHub credentials. That last part is what
saves you from password prompts later.

Then, from inside this folder:

```bash
cd "/Users/dylan/Desktop/Heat Pump Guides/Website Design/redesign"
git init -b main
git config user.name "Dylan Marshall"
git config user.email "dmarshall707@gmail.com"
git add .
git commit -m "Heat Pump Guides site: homepage and Massachusetts state page"
gh repo create heatpumpguides --public --source=. --remote=origin --push
```

That last command creates the repo on GitHub and pushes in one go.

### If the repo already exists

Skip `gh repo create` and do this instead:

```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

If it already has commits, reconcile before pushing rather than forcing:

```bash
git pull --rebase origin main
git push -u origin main
```

## 5. Turn on GitHub Pages

On github.com: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save.**

Give it a minute; it publishes at `https://<you>.github.io/<repo>/`.

⚠️ On that default URL the site lives in a subfolder, so the absolute links
(`/massachusetts`) will point at the domain root and 404. This resolves itself
once you attach the custom domain below. If you'd rather not use a custom domain,
name the repo `<your-username>.github.io` — that publishes at the domain root and
the links work.

## 6. Custom domain

`CNAME` in this folder already contains `heatpumpguides.com`. Set the matching DNS
at your registrar:

| Type  | Name  | Value                        |
|-------|-------|------------------------------|
| A     | `@`   | `185.199.108.153`            |
| A     | `@`   | `185.199.109.153`            |
| A     | `@`   | `185.199.110.153`            |
| A     | `@`   | `185.199.111.153`            |
| CNAME | `www` | `<you>.github.io`            |

Then **Settings → Pages → Custom domain**, enter the domain, and once the check
passes tick **Enforce HTTPS**. DNS can take up to an hour.

If you aren't using a custom domain, delete `CNAME`.

## 7. Adding the other 49 states

You never hand-write a state page. The workflow is:

1. Open `_build/states.data.json` and copy the `massachusetts` block.
2. Change the key to the new slug — it must match the homepage map link exactly
   (`new-hampshire`, `district-of-columbia`, …). The generator errors out if it
   can't find matching map geometry, so a typo fails loudly instead of silently.
3. Fill in the numbers. Leave anything you haven't verified as `null` — the stat
   is dropped from the page rather than shown as a guess.
4. Build and publish:

```bash
node _build/mkstates.js
git add .
git commit -m "Add New Hampshire state page"
git push
```

Pages redeploys automatically within a minute or so.

### Tagging episodes to a state

The `episodes` array matches against the live RSS feed. Put either the episode's
guid or any distinctive fragment of its title in it:

```json
"episodes": ["California Legislation", "1865c8ff-2607-4a41-b9cb-a54b7ed1f221"]
```

An empty array renders the three placeholder slots instead. Nothing else to wire up —
the page reads the feed itself on load, so newly tagged episodes appear without a rebuild.

## 8. Everyday loop

```bash
# preview locally — use a server, file:// blocks the RSS fetch
python3 -m http.server 8765
```

```bash
# after editing _build/states.data.json or _build/state.template.html
node _build/mkstates.js
```

```bash
# after editing _build/index.template.html
node _build/build.js
```

`styles.css`, `script.js` and `state.js` are hand-written — edit them directly,
no build step.
