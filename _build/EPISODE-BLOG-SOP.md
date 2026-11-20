# SOP: Turning a podcast episode into blog posts

Every Heat Pump Guides episode produces up to two posts:

1. **Main post**: lives on heatpumpguides.com/blog/, built from the transcript. Every episode gets one.
2. **Companion post**: interview episodes only. Written in the guest contractor's voice for *their* website, linking back to the main post.

The Claude Code skill `/episode-blog` runs this whole SOP. This file is the rulebook it follows. Change the rules here, not in the skill.

Build mechanics (file layout, `mkblog.js` checks, styling hooks) are in `_build/README.md` → "Blog posts". This SOP covers *what to write* and *in what order*.

---

## 0. Inputs

| Input | Where it comes from |
|---|---|
| Episode audio, title, guid, date, platform links | `node _build/mkepisodes.js` (RSS feed + Spotify/Apple/YouTube lookups) |
| Transcript | Descript: search the drive for the episode/guest name → `export_transcript` (txt, speaker labels on change, timecodes on paragraphs). If it isn't in Descript, ask Dylan to paste it. |
| Guest details (interview episodes) | Episode description in the feed, the transcript intro, and the guest's own website. Confirm name spelling and company name against their website, because transcription often gets them wrong (Ep 10: "Hello Comfort" → **Hella** Comfort). |

If Spotify/YouTube haven't listed the episode yet, `mkepisodes.js` leaves the links blank. Re-run it a few hours later. Hand fixes in `episode-links.json` are never overwritten.

---

## 1. Main post (heatpumpguides.com)

### SEO rules (why each exists)

| Rule | Why |
|---|---|
| **One search intent per post.** Pick the question a homeowner would actually Google ("SMUD heat pump rebate", "Sacramento heat pump"), and make sure no existing post already targets it. | Two posts chasing the same query compete with each other (keyword cannibalization). |
| **Answer first.** `post-intro` states the answer in 2–3 sentences, then a `keybox` with the short answer. | Readers and AI search summaries both pull from the top of the page. |
| **Rewrite into an article; never paste the transcript as the body.** Restructure by topic, not by the order things were said. Add context the episode didn't have: current figures, links to primary sources, a table or worked example. | Google's people-first content guidance rewards original value over repackaged text. The raw transcript still ships in `transcript.txt` for completeness. |
| **Fact-check every number and program against a primary source.** Things that changed since recording go in an `ed-note` right after the claim. Where the guest was right, cite the source. Where something needs correcting (e.g. an imprecise formula), correct it gently in the article text. | E-E-A-T: home energy spending is a "your money" topic, where accuracy is weighed more heavily. |
| **Headings describe their section in plain words**, h2 → h3 with no skipped levels. Use phrasing people search for ("Do you need a cold-climate heat pump in Sacramento?"). | Scannable pages; `mkblog.js` builds the table of contents from the h2s. |
| **Internal links:** link the relevant state page (`/california/`), 2–4 related posts, and `/apply/`. Descriptive anchors only. | Spreads authority across the site; `mkblog.js` rejects vague anchors and dead internal links. |
| **External links:** primary sources (utility, IRS, state program pages), no tracking parameters. | Trust signals; `--check-links` verifies them. |
| **`seoTitle` ≤ 60 characters, `description` ≤ 155**, both containing the main query naturally. The `headline` (h1) can be longer and more descriptive. | Avoids truncation in search results. |
| **Slug:** short, lowercase, keyword-first, no episode number, no dates (`sacramento-heat-pumps-smud-rebates`). | Clean URLs that stay accurate if the post is updated later. |

### Structure (match Episodes 1–10)

```
<p class="post-intro">  answer in 2–3 sentences
<div class="keybox">    "The short answer", 3–5 bullets
<h2> sections by topic, h3 for sub-questions
     tables in <div class="table-wrap">, source notes in <p class="src">
     <aside class="ed-note"> for anything outdated since recording
<h2 id="sources">Sources</h2>   bulleted primary sources
```

**Interview episodes add:**
- `<h2 id="meet-the-guest">` right after the keybox: who they are, years in the trade, service area, one link to their website using their **business name** as the anchor.
- A closing h2 on how to hire them locally, with a second link to their site. Two links to the guest site, no more.
- `"guest": { name, jobTitle, company, url, areaServed }` in `post.json`. `mkblog.js` adds them to the PodcastEpisode structured data (`actor` → `HVACBusiness`).
- Speaker labels in `transcript.txt` (`[m:ss] Jairo: …`).

**Voice:** plain, direct, second person ("you"), short paragraphs, no hype. Attribute opinions to the guest ("Jairo says…"). Length follows the episode: about 900–1,200 words for a 5-minute solo episode, about 1,400–1,800 for a 25-minute interview.

### Files

`_build/blog/<slug>/`
- `post.json`: guid, slug, headline, subheading, seoTitle, description, published (YYYY-MM-DD), related (3 slugs), and guest (interviews only)
- `article.html`: starts at `<p class="post-intro">`, no h1
- `transcript.txt`: one paragraph per line, `[m:ss] text`. Light clean-up only: remove ums, stutters and false starts, and fix names. Never change meaning.

### Build and verify

```bash
node _build/mkepisodes.js
node _build/mkblog.js --check-links
node _build/build.js
```

Then preview (`python3 -m http.server 8765` in the site folder) and check: the post renders, the player plays, the transcript timestamps seek, and the homepage episode card links to the post.

---

## 2. State page check

Each state page lists an episode **automatically** only when the state's full name appears in the episode title or description. "Sacramento, CA" does **not** match "California".

For every episode tied to a place, open the state page and confirm the episode appears under "Recorded in <State>". If it's missing, add the episode guid to that state's `"episodes"` array in `_build/states.data.json`, then run:

```bash
node _build/mkstates.js
```

Tip for future titles: writing the state name out in full ("Sacramento, California") makes this automatic.

---

## 3. Companion post (guest's website, interview episodes only)

### Why it's built this way

Google's spam policy names "excessive link exchanges ('link to me and I'll link to you')" as link spam. Its syndication guidance also says copied content should be blocked from indexing, not canonicalized. So the companion post is not a copy of the main post and not a link swap for its own sake. It's a genuine, distinct article that is useful to the contractor's own customers, and the backlink is the natural citation of where the interview happened.

### Rules

| Rule | Detail |
|---|---|
| **Unique text.** | Write it from scratch. Don't reuse paragraphs from the main post. Different title, different structure, different angle. |
| **Contractor's voice, first person.** | "I sat down with Heat Pump Guides…". Use only claims the guest actually made on the episode. Never invent prices, credentials or anecdotes. |
| **Local and commercial angle.** | Built around the questions *their* customers ask (rebate eligibility, process, what it costs), with their service area named. That way it ranks for their local searches instead of competing with our post. |
| **One link back, in the body, with natural anchor text.** | Point it at the specific episode post, not the homepage. Use a descriptive, non-keyword-stuffed anchor ("my interview on heat pumps in Sacramento with Heat Pump Guides"). No sitewide, footer or widget links. |
| **No payment, ever.** | If money or services are exchanged for the post or link, the link must carry `rel="sponsored"`. Keep it editorial: no fee to be a guest, no fee to publish. |
| **Not used elsewhere.** | Each companion goes to one site only. Never send the same companion text to two contractors. |
| **Length:** 600–900 words. | |
| **Leave placeholders** for their phone number / CTA in `[brackets]`. | |

### Delivery

1. Create a Google Doc titled `Companion Post – Ep <N> – <Business name> (<topic>)` with:
   - a **publishing notes** box at the top (delete before posting): suggested URL, SEO title ≤ 60 characters, meta description ≤ 155, photo suggestion with alt text, episode embed link, and a request to keep the link back
   - the article itself
2. Dylan reviews it, then shares it with the guest (the doc is created private).
3. When the guest publishes, check that their page links to the main post, then optionally add a "Read Jairo's take on Hella Comfort's blog" line to the main post's guest section. That is a normal, editorially justified two-way citation.

---

## 4. Checklist

- [ ] `mkepisodes.js` run; all three platform links found (or a re-run scheduled)
- [ ] Transcript exported, cleaned, names verified against the guest's website
- [ ] Facts checked; sources linked; `ed-note` added where something changed
- [ ] `post.json` complete; seoTitle ≤ 60, description ≤ 155; 3 related slugs
- [ ] `mkblog.js --check-links` passes; `build.js` run
- [ ] Previewed locally
- [ ] State page shows the episode (pin the guid in `states.data.json` if not)
- [ ] Interview: companion Google Doc created, then reviewed and sent by Dylan
- [ ] Changed files uploaded to the live site by Dylan: `blog/`, `index.html`, `sitemap.xml`, any state folders rebuilt, `_build/`
