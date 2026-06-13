# Who Made AI?

An interactive atlas of the **114 people who shaped artificial intelligence** — from Alan Turing to today's frontier-lab founders. Each person is a node in a force-directed network graph; people who work on the same topics are connected by lines. Click any figure to read a full research profile.

It's a single static page with no build step, deployed on Cloudflare.

---

## What you see

- **The graph** — every dot is a person, sized by influence and colored by domain. A physics simulation clusters people who belong to the same domain and pulls connected people together.
- **Domains** (the six node colors): AI Founders (pre-1990), Academic Researchers, Industry Leaders, AI Safety / Alignment, AI Ethics & Fairness, and Policy & Governance.
- **Topics** (25 of them, e.g. Large Language Models, Deep Learning, AI Safety, Robotics) — the topic chip rail at the top filters the network. Activating topics draws the connections that share those topics; a badge reports how many.
- **Search** — type a name (or press `/`) to dim everyone who doesn't match.
- **Profiles** — clicking a person opens a "paper page" with their research profile organized into tabs (Overview, Research, Positions, Media, Values, Criticism), a one-paragraph summary lede, and chips linking to their most-connected peers so you can navigate the network by reading.
- **Figures drawer** — the "All figures" button opens a searchable, alphabetical index of everyone.
- **Mobile** — on phones the profile becomes a draggable bottom sheet and the layout adapts to touch.

---

## How it works

The site is plain HTML/CSS/JavaScript. Two libraries load from a CDN (pinned with Subresource Integrity hashes): **D3 v7** for the force simulation and SVG rendering, and **marked v9** for rendering profile markdown.

**The network.** People and their topics live in `data/figures-data.js`. At load, the app computes an edge between every pair of people who share at least one topic (`computeEdges`), weighting the edge by how many topics they share. D3's force simulation (charge, centering, collision, and a per-domain clustering force) lays the graph out. Hovering, selecting, topic-filtering, and search all re-render which edges are visible.

**The profiles.** Each person has a long markdown research profile in `data/research-data.js` and a short summary in `data/summaries-data.js`, both keyed by the same short person ID used in `figures-data.js`. When you open a profile, `js/profile-sections.js` splits the markdown on its `##` headings and maps those sections onto the six reader tabs (tolerant of `&`/`and` and capitalization differences; any unrecognized section falls back into Overview). This module is pure logic with no DOM dependency, so it runs both in the browser and under Node for tests.

**Light-theme colors.** The data files carry the original color values; `js/app.js` re-tunes the domain and topic colors for the light background at load, so all theming is centralized.

---

## Project layout

```
index.html              Markup shell: header, topic rail, graph stage, drawer,
                        profile panel, welcome card. Loads the scripts below.
css/styles.css          All styling, driven by :root design tokens (one place
                        to retheme — paper/ink/rule colors, the accent, fonts).
js/profile-sections.js  Pure parser: research markdown -> ordered reader tabs.
js/app.js               All behavior: color retuning, edge computation, the D3
                        force graph, topic rail, search, selection/hover, zoom,
                        figures drawer, tabbed profile renderer, welcome card,
                        mobile bottom sheet.
data/figures-data.js    DOMAINS, TOPICS, PEOPLE, BIOS — the core dataset.
data/research-data.js   RESEARCH: full markdown profile per person.
data/summaries-data.js  SUMMARIES: one-paragraph summary per person.
tests/                  Node tests for the profile parser (see below).
docs/                   Design specs and implementation plans.
wrangler.jsonc          Cloudflare configuration.
.assetsignore           Keeps docs/, tests/, and dev artifacts out of the
                        deployed site.
```

The data layer is plain global `const` declarations loaded as classic scripts (no bundler). Script load order in `index.html` matters: D3 and marked, then the three data files, then `profile-sections.js`, then `app.js`.

---

## Adding or editing a figure

A person is identified by a short `id` (e.g. `hinton`) that ties three files together. To add someone:

1. **`data/figures-data.js`** — add an entry to `PEOPLE`:
   ```js
   { id:"newid", name:"Full Name", role:"Their role", org:"Org",
     domain:"research", size:7, topics:["deep_learning","ai_safety"] }
   ```
   `domain` must be one of the six domain keys; `topics` must reference existing topic IDs; `size` (5–10) controls the node radius. Optionally add a short bio to `BIOS` keyed by the same `id`.
2. **`data/research-data.js`** — add a `RESEARCH["newid"]` markdown profile. Use the standard `##` section headings so it maps cleanly onto the tabs.
3. **`data/summaries-data.js`** — add a `SUMMARIES["newid"]` one-paragraph summary.

Run the smoke test afterward (below) to confirm the new profile parses into tabs with no unmapped sections. Counts like "114 people · 25 topics" are computed from the data, so they update automatically.

---

## Local development

No install step. Serve the folder with Wrangler (Cloudflare's CLI):

```bash
npx wrangler dev      # serves at http://localhost:8787
```

Any static file server works too — the site is fully static.

### Tests

The profile parser is unit-tested, and a smoke test validates that all profiles map cleanly to tabs. They use Node's built-in test runner (Node 18+):

```bash
node --test tests/*.test.cjs      # unit tests for the section -> tab parser
node tests/all-profiles-smoke.cjs # checks every profile parses, 0 unmapped sections
```

> Note: the directory form `node --test tests/` does not work on some Node/Windows
> setups — use the `tests/*.test.cjs` glob shown above.

---

## Deployment

The site is hosted on **Cloudflare** as static Workers assets (`wrangler.jsonc`). It's connected to this GitHub repository, so **every push to `main` automatically redeploys** (~60 seconds). There is no build command — files are served as-is from the repo root. `.assetsignore` excludes `docs/`, `tests/`, and local dev artifacts from what gets served.

---

## Credits

The research profiles were written for the *Catholics in Tech Podcast*. Built as a static site with D3.js and marked.js.
