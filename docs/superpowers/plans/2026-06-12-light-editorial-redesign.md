# Light Editorial Redesign ("Atlas App") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Who Made AI? presentation layer as a warm-paper editorial "Atlas App" — graph-as-page, tabbed profile reading, first-class mobile — per the approved spec at `docs/superpowers/specs/2026-06-12-light-editorial-redesign-design.md`.

**Architecture:** The single 1,482-line `index.html` is split into a thin HTML shell, one token-driven stylesheet, a pure-logic module for profile section parsing (unit-testable in Node), and one app script. The data layer (`PEOPLE`/`TOPICS`/`DOMAINS`/`BIOS` moved verbatim to `data/figures-data.js`; `research-data.js`/`summaries-data.js` untouched) and the D3 force-graph model are preserved. No build step — classic scripts and CDN dependencies, so Cloudflare deployment stays zero-config.

**Tech Stack:** Vanilla JS, D3 v7 (CDN), marked v9 (CDN), Google Fonts (Fraunces / Source Serif 4 / Inter), Node built-in test runner (`node --test`) for pure logic, `npx wrangler dev` for local serving.

**Reference mockup (approved look):** `.superpowers/brainstorm/879-1781310465/content/atlas-final-v2.html` (local only, gitignored).

---

## File Structure

| File | Responsibility |
|---|---|
| `index.html` | Markup shell only: header, topic rail, stage (svg + overlays), welcome card, profile, drawer; script/link tags |
| `css/styles.css` | All styling, driven by `:root` design tokens |
| `js/profile-sections.js` | Pure functions: parse profile markdown into `##` sections, map sections to reader tabs. Dual browser/Node (CommonJS export + `window.ProfileSections`) |
| `js/app.js` | Everything interactive: theme color overrides, derived data, D3 sim, rail, search, selection, hover, zoom, drawer, profile renderer, welcome card, mobile sheet |
| `data/figures-data.js` | `DOMAINS`, `TOPICS`, `PEOPLE`, `BIOS` moved **verbatim** from old index.html |
| `data/research-data.js` | UNCHANGED |
| `data/summaries-data.js` | UNCHANGED |
| `tests/profile-sections.test.cjs` | Unit tests for parsing/mapping |
| `tests/all-profiles-smoke.cjs` | Loads real data files; asserts all 114 profiles parse into tabs with zero unmapped sections |
| `.assetsignore` | Keep `docs/`, `tests/`, `.superpowers/` out of the deployed Cloudflare assets |

Work happens on branch `redesign/light-editorial`. The site is intentionally broken between Tasks 5 and 6 (shell exists before app.js) — that's fine on a branch; never merge mid-plan.

---

### Task 1: Branch + extract figures data

**Files:**
- Create: `data/figures-data.js`
- Modify: `index.html` (the OLD file — minimal surgical change)

- [ ] **Step 1: Create branch**

```bash
git checkout -b redesign/light-editorial
```

- [ ] **Step 2: Create `data/figures-data.js`**

Create the file with this header, then MOVE (cut from `index.html`, paste here, byte-identical) the four top-level declarations `const DOMAINS = {…};` (starts at `index.html:580`), `const TOPICS = […];`, `const PEOPLE = […];`, and `const BIOS = {…};` (ends near `index.html:871`), **in that order**. The line `const topicById = Object.fromEntries(TOPICS.map(t => [t.id, t]));` between TOPICS and PEOPLE is derived data — it STAYS in index.html. The `// BIOS` banner comment moves with BIOS.

```js
// Core figures dataset for "Who Made AI?" — DOMAINS, TOPICS, PEOPLE, BIOS.
// Moved verbatim from index.html. Colors here are the original dark-theme
// values; js/app.js re-tunes them for the light theme at load (see design
// spec docs/superpowers/specs/2026-06-12-light-editorial-redesign-design.md).
```

- [ ] **Step 3: Reference it from old index.html**

In `index.html`, add one script tag **before** the research-data one (`index.html:573`):

```html
<script src="data/figures-data.js"></script>
```

- [ ] **Step 4: Verify the old site still works**

Run: `npx wrangler dev` → open http://localhost:8787
Expected: graph renders exactly as before; hover/click/topic filtering all work; no console errors. (This proves the data move is clean before the rewrite starts.)

- [ ] **Step 5: Commit**

```bash
git add data/figures-data.js index.html
git commit -m "refactor: extract figures dataset to data/figures-data.js

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Profile section parser (TDD)

**Files:**
- Create: `js/profile-sections.js`
- Test: `tests/profile-sections.test.cjs`

- [ ] **Step 1: Write the failing tests**

```js
// tests/profile-sections.test.cjs
const test = require("node:test");
const assert = require("node:assert");
const { parseSections, mapSectionsToTabs, TAB_ORDER } =
  require("../js/profile-sections.js");

const SAMPLE = [
  "# Research Profile: Jane Doe",
  "### Catholics in Tech Podcast",
  "",
  "---",
  "",
  "## Identity & Background",
  "**Born:** 1970",
  "",
  "## Research & Technical Contributions",
  "Did research.",
  "",
  "## Published Works",
  "Wrote books.",
  "",
  "## Public Positions & Philosophy",
  "Has positions.",
  "",
  "## Media & Outreach",
  "Gave talks.",
  "",
  "## Values",
  "Has values.",
  "",
  "## Controversy & Criticism",
  "Was criticized.",
].join("\n");

test("parseSections splits on ## headings and drops the preamble", () => {
  const s = parseSections(SAMPLE);
  assert.strictEqual(s.length, 7);
  assert.strictEqual(s[0].title, "Identity & Background");
  assert.match(s[0].body, /\*\*Born:\*\* 1970/);
  // preamble (# title, ### podcast subtitle, ---) appears nowhere
  assert.ok(s.every(x => !x.body.includes("Catholics in Tech")));
});

test("mapSectionsToTabs groups all 7 canonical sections into 6 tabs", () => {
  const tabs = mapSectionsToTabs(parseSections(SAMPLE), () => {});
  assert.deepStrictEqual(tabs.map(t => t.tab),
    ["Overview", "Research", "Positions", "Media", "Values", "Criticism"]);
  const research = tabs.find(t => t.tab === "Research");
  assert.deepStrictEqual(research.sections.map(s => s.title),
    ["Research & Technical Contributions", "Published Works"]);
});

test("matching tolerates case and &/and variants", () => {
  const md = "## IDENTITY AND BACKGROUND\nx\n## Media and Outreach\ny\n";
  const tabs = mapSectionsToTabs(parseSections(md), () => {});
  assert.ok(tabs.find(t => t.tab === "Overview").sections.length === 1);
  assert.ok(tabs.find(t => t.tab === "Media").sections.length === 1);
});

test("unmapped sections land in Overview and fire the callback", () => {
  const md = "## Identity & Background\nx\n## Hobbies\nfishing\n";
  const unmapped = [];
  const tabs = mapSectionsToTabs(parseSections(md), t => unmapped.push(t));
  assert.deepStrictEqual(unmapped, ["Hobbies"]);
  const ov = tabs.find(t => t.tab === "Overview");
  assert.deepStrictEqual(ov.sections.map(s => s.title),
    ["Identity & Background", "Hobbies"]);
});

test("empty tabs are hidden, but Overview always survives", () => {
  const md = "## Values\nv\n";
  const tabs = mapSectionsToTabs(parseSections(md), () => {});
  assert.deepStrictEqual(tabs.map(t => t.tab), ["Overview", "Values"]);
});

test("TAB_ORDER is the canonical six", () => {
  assert.deepStrictEqual(TAB_ORDER,
    ["Overview", "Research", "Positions", "Media", "Values", "Criticism"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module '../js/profile-sections.js'`

- [ ] **Step 3: Implement `js/profile-sections.js`**

```js
// Parses research-profile markdown into ## sections and maps them onto the
// reader tabs used by the profile paper page. Pure logic — no DOM — so it is
// loadable both as a classic browser script (window.ProfileSections) and in
// Node for tests (module.exports).
(function (global) {
  "use strict";

  const TAB_ORDER = ["Overview", "Research", "Positions", "Media", "Values", "Criticism"];

  // Normalized section title → tab name. See design spec table.
  const SECTION_TO_TAB = {
    "identity and background": "Overview",
    "research and technical contributions": "Research",
    "published works": "Research",
    "public positions and philosophy": "Positions",
    "media and outreach": "Media",
    "values": "Values",
    "controversy and criticism": "Criticism",
  };

  function normalizeTitle(title) {
    return title.trim().toLowerCase()
      .replace(/\s*&\s*/g, " and ")
      .replace(/\s+/g, " ");
  }

  // Split markdown into {title, body} chunks, one per "## " heading. Content
  // before the first "## " (the "# Research Profile" line, the podcast
  // subtitle, horizontal rules) is dropped — the styled profile header block
  // replaces it in the UI.
  function parseSections(mdText) {
    const sections = [];
    let current = null;
    for (const line of String(mdText).split("\n")) {
      const m = line.match(/^## (.+)$/);
      if (m) {
        if (current) sections.push(current);
        current = { title: m[1].trim(), body: "" };
      } else if (current) {
        current.body += line + "\n";
      }
    }
    if (current) sections.push(current);
    return sections;
  }

  // Group parsed sections into ordered tabs: [{tab, sections:[{title,body}]}].
  // Empty tabs are dropped, except Overview (it always exists — it hosts the
  // summary lede and the connected-figures block even with no sections).
  // Unmapped section titles go to Overview and are reported via onUnmapped.
  function mapSectionsToTabs(sections, onUnmapped) {
    const byTab = new Map(TAB_ORDER.map(t => [t, []]));
    for (const s of sections) {
      const tab = SECTION_TO_TAB[normalizeTitle(s.title)];
      if (!tab) {
        if (onUnmapped) onUnmapped(s.title);
        byTab.get("Overview").push(s);
      } else {
        byTab.get(tab).push(s);
      }
    }
    return TAB_ORDER
      .map(tab => ({ tab, sections: byTab.get(tab) }))
      .filter(t => t.sections.length > 0 || t.tab === "Overview");
  }

  const api = { TAB_ORDER, parseSections, mapSectionsToTabs, normalizeTitle };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.ProfileSections = api;
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: 6 passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add js/profile-sections.js tests/profile-sections.test.cjs
git commit -m "feat: add profile section parser with tab mapping (TDD)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: All-profiles smoke test against real data

**Files:**
- Create: `tests/all-profiles-smoke.cjs`

- [ ] **Step 1: Write the smoke script**

```js
// tests/all-profiles-smoke.cjs
// Loads the REAL data files and verifies every person's research profile
// parses into tabs with no unmapped sections. Exits 1 on any failure.
// Run: node tests/all-profiles-smoke.cjs
const fs = require("node:fs");
const path = require("node:path");
const { parseSections, mapSectionsToTabs } = require("../js/profile-sections.js");

function loadGlobal(file, name) {
  const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  return new Function(`${src}; return ${name};`)();
}

const PEOPLE = loadGlobal("data/figures-data.js", "PEOPLE");
const RESEARCH = loadGlobal("data/research-data.js", "RESEARCH");
const SUMMARIES = loadGlobal("data/summaries-data.js", "SUMMARIES");

let failures = 0;
for (const p of PEOPLE) {
  const md = RESEARCH[p.id];
  if (!md) { console.error(`FAIL ${p.id}: no RESEARCH entry`); failures++; continue; }
  if (!SUMMARIES[p.id]) console.warn(`warn ${p.id}: no SUMMARIES entry`);
  const unmapped = [];
  const tabs = mapSectionsToTabs(parseSections(md), t => unmapped.push(t));
  if (unmapped.length) { console.error(`FAIL ${p.id}: unmapped sections: ${unmapped.join(" | ")}`); failures++; }
  if (tabs.length < 2) { console.error(`FAIL ${p.id}: only ${tabs.length} tab(s)`); failures++; }
}
console.log(`Checked ${PEOPLE.length} profiles — ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run it**

Run: `node tests/all-profiles-smoke.cjs`
Expected: `Checked 114 profiles — 0 failure(s).`

If any profile reports unmapped sections: add the normalized title to `SECTION_TO_TAB` in `js/profile-sections.js` (choosing the tab per the spec's intent), extend the unit tests with that variant, and re-run both `node --test tests/` and the smoke script until clean. Do NOT edit the data files.

- [ ] **Step 3: Commit**

```bash
git add tests/all-profiles-smoke.cjs js/profile-sections.js tests/profile-sections.test.cjs
git commit -m "test: add all-profiles smoke test for tab mapping

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Stylesheet

**Files:**
- Create: `css/styles.css`

- [ ] **Step 1: Write `css/styles.css`**

Complete file:

```css
/* Who Made AI? — Light Editorial theme. All theming flows through :root tokens. */

:root {
  --paper: #faf7f2;
  --paper-warm: #fffdf9;
  --ink: #1a1a1a;
  --ink-soft: #44403a;
  --ink-faint: #8a8377;
  --ink-ghost: #a39b8b;
  --rule: #e2dccf;
  --rule-dark: #c9c2b4;
  --accent: #2563eb;
  --shadow-lg: 0 24px 70px rgba(26, 26, 26, 0.18);
  --shadow-md: 0 14px 44px rgba(26, 26, 26, 0.13);
  --font-display: 'Fraunces', Georgia, serif;
  --font-serif: 'Source Serif 4', Georgia, serif;
  --font-ui: 'Inter', system-ui, sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body { height: 100%; }
body {
  font-family: var(--font-ui);
  background: var(--paper);
  color: var(--ink);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

button { font-family: var(--font-ui); cursor: pointer; }
[hidden] { display: none !important; }

/* ── Header ── */
header {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 13px 22px;
  border-bottom: 2px solid var(--ink);
  flex-shrink: 0;
}
header h1 {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.02em;
  white-space: nowrap;
}
header h1 em { color: var(--accent); font-style: italic; }
.tagline {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--ink-faint);
  white-space: nowrap;
}
.search-wrap {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--rule-dark);
  border-radius: 99px;
  padding: 0 14px;
  background: var(--paper-warm);
  width: 250px;
}
.search-wrap:focus-within { border-color: var(--accent); }
#search {
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--ink);
  padding: 8px 0;
  width: 100%;
}
#search::placeholder { color: var(--ink-ghost); }
.kbd {
  font-size: 10px;
  border: 1px solid var(--rule-dark);
  border-radius: 4px;
  padding: 1px 5px;
  color: var(--ink-ghost);
  flex-shrink: 0;
}
.figures-btn {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink-soft);
  border: 1px solid var(--rule-dark);
  background: transparent;
  border-radius: 99px;
  padding: 8px 16px;
  white-space: nowrap;
}
.figures-btn:hover { border-color: var(--ink); color: var(--ink); }

/* ── Topic rail ── */
.rail {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  border-bottom: 1px solid var(--rule);
  overflow-x: auto;
  flex-shrink: 0;
  scrollbar-width: none;
}
.rail::-webkit-scrollbar { display: none; }
.rail-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  font-weight: 600;
  color: var(--ink-ghost);
  flex-shrink: 0;
  margin-right: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--rule-dark);
  border-radius: 99px;
  padding: 5px 13px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-soft);
  white-space: nowrap;
  background: transparent;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  flex-shrink: 0;
}
.chip:hover { border-color: var(--ink); }
.chip.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.chip .dot { width: 7px; height: 7px; border-radius: 99px; flex-shrink: 0; }
.chip-count { font-size: 10px; opacity: 0.55; }

.dot { display: inline-block; width: 8px; height: 8px; border-radius: 99px; flex-shrink: 0; }

/* ── Stage & graph ── */
.stage {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse 90% 70% at 50% 40%, var(--paper-warm) 0%, var(--paper) 75%);
}
#graph { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
.node { cursor: pointer; }
.node-label {
  font-family: var(--font-serif);
  font-size: 11px;
  font-weight: 600;
  fill: var(--ink);
  text-anchor: middle;
  paint-order: stroke fill;
  stroke: var(--paper-warm);
  stroke-width: 3px;
  pointer-events: none;
}
.link { fill: none; pointer-events: none; }

/* ── Hover/tap card ── */
#hover-card {
  position: absolute;
  background: var(--paper-warm);
  border: 1px solid var(--rule);
  border-radius: 10px;
  box-shadow: var(--shadow-md);
  padding: 12px 14px;
  max-width: 260px;
  z-index: 60;
}
.hc-kicker { font-size: 9px; letter-spacing: 0.14em; font-weight: 600; margin-bottom: 3px; }
.hc-name { font-family: var(--font-display); font-size: 16px; font-weight: 700; }
.hc-role { font-family: var(--font-serif); font-style: italic; font-size: 12px; color: var(--ink-faint); margin-top: 2px; }
.hc-btn {
  margin-top: 9px;
  font-size: 12px;
  font-weight: 600;
  background: var(--ink);
  color: var(--paper);
  border: none;
  border-radius: 99px;
  padding: 6px 14px;
}

/* ── Connection badge ── */
#conn-badge {
  position: absolute;
  right: 22px;
  bottom: 150px;
  background: var(--paper-warm);
  border: 1px solid var(--rule);
  border-radius: 99px;
  padding: 5px 14px;
  font-size: 11px;
  color: var(--ink-faint);
  max-width: 420px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  z-index: 40;
}

/* ── Zoom controls ── */
.zoom {
  position: absolute;
  right: 22px;
  bottom: 22px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 40;
}
.zoom button {
  width: 34px;
  height: 34px;
  border-radius: 99px;
  border: 1px solid var(--rule-dark);
  background: var(--paper-warm);
  color: var(--ink-soft);
  font-size: 16px;
  box-shadow: 0 2px 8px rgba(26, 26, 26, 0.06);
}
.zoom button:hover { border-color: var(--ink); color: var(--ink); }

/* ── Welcome card ── */
#welcome {
  position: absolute;
  left: 22px;
  bottom: 22px;
  width: 320px;
  background: var(--paper-warm);
  border: 1px solid var(--rule);
  border-top: 3px solid var(--accent);
  border-radius: 10px;
  box-shadow: var(--shadow-md);
  padding: 18px 20px;
  z-index: 50;
}
#welcome .kicker {
  font-size: 10px;
  letter-spacing: 0.16em;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 6px;
}
#welcome h2 { font-family: var(--font-display); font-size: 19px; font-weight: 700; margin-bottom: 6px; }
#welcome p {
  font-family: var(--font-serif);
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--ink-soft);
  margin-bottom: 12px;
}
.legend { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 10px; margin-bottom: 14px; }
.legend span { display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--ink-soft); }
.legend i { width: 9px; height: 9px; border-radius: 99px; flex-shrink: 0; }
.cta {
  font-size: 12.5px;
  font-weight: 600;
  background: var(--ink);
  color: var(--paper);
  border: none;
  border-radius: 99px;
  padding: 8px 18px;
}
.dismiss { font-size: 12px; color: var(--ink-ghost); margin-left: 10px; background: none; border: none; }
.dismiss:hover { color: var(--ink-soft); }

/* ── Profile paper page ── */
#profile {
  position: absolute;
  top: 20px;
  right: 20px;
  bottom: 20px;
  width: min(560px, 46%);
  background: var(--paper-warm);
  border: 1px solid var(--rule);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 70;
}
.profile-head { padding: 20px 28px 14px; border-bottom: 1px solid var(--rule); position: relative; flex-shrink: 0; }
.sheet-handle { display: none; }
#profile-kicker { font-size: 10px; letter-spacing: 0.16em; font-weight: 600; margin-bottom: 7px; }
#profile-name {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
  padding-right: 36px;
}
#profile-role { font-family: var(--font-serif); font-style: italic; font-size: 13.5px; color: var(--ink-faint); }
.close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 30px;
  height: 30px;
  border-radius: 99px;
  border: 1px solid var(--rule-dark);
  background: transparent;
  color: var(--ink-faint);
  font-size: 13px;
}
.close:hover { border-color: var(--ink); color: var(--ink); }

.ptabs { display: flex; gap: 2px; padding: 0 22px; border-bottom: 1px solid var(--rule); flex-shrink: 0; overflow-x: auto; scrollbar-width: none; }
.ptabs::-webkit-scrollbar { display: none; }
.ptab {
  font-size: 12px;
  font-weight: 500;
  padding: 10px 11px;
  color: var(--ink-ghost);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}
.ptab.on { color: var(--ink); border-bottom-color: var(--accent); font-weight: 600; }

.pbody {
  flex: 1;
  overflow-y: auto;
  padding: 22px 28px 40px;
  font-family: var(--font-serif);
  font-size: 14.5px;
  line-height: 1.75;
  color: var(--ink-soft);
  scrollbar-width: thin;
}
.lede {
  font-size: 16px;
  line-height: 1.65;
  color: var(--ink);
  border-left: 3px solid var(--accent);
  padding: 4px 0 4px 18px;
  margin-bottom: 22px;
}
.pbody h3 {
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--ink-ghost);
  text-transform: uppercase;
  margin: 24px 0 10px;
}
.pbody h3:first-child { margin-top: 0; }
.pbody p { margin-bottom: 12px; }
.pbody strong { color: var(--ink); }
.pbody a { color: var(--accent); text-decoration: none; }
.pbody a:hover { text-decoration: underline; }
.pbody ul, .pbody ol { padding-left: 22px; margin-bottom: 12px; }
.pbody li { margin-bottom: 4px; }
.pbody table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12.5px; font-family: var(--font-ui); }
.pbody th {
  text-align: left;
  padding: 7px 10px;
  border: 1px solid var(--rule);
  background: var(--paper);
  color: var(--ink-faint);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.pbody td { padding: 7px 10px; border: 1px solid var(--rule); vertical-align: top; word-break: break-word; }
.pbody blockquote {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 16.5px;
  line-height: 1.5;
  color: var(--ink);
  border-top: 1px solid var(--ink);
  border-bottom: 1px solid var(--rule);
  padding: 12px 4px;
  margin: 16px 0;
}
.pbody code {
  font-size: 12.5px;
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 1px 5px;
}
.pbody hr { border: none; border-top: 1px solid var(--rule); margin: 20px 0; }
.muted { color: var(--ink-ghost); font-style: italic; }

.conn { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.conn-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-soft);
  background: transparent;
  border: 1px solid var(--rule-dark);
  border-radius: 99px;
  padding: 5px 12px;
}
.conn-chip:hover { border-color: var(--ink); color: var(--ink); }

/* ── Figures drawer ── */
#drawer-scrim { position: absolute; inset: 0; background: rgba(26, 26, 26, 0.25); z-index: 80; }
#drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  background: var(--paper-warm);
  border-left: 1px solid var(--rule);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  z-index: 90;
}
.drawer-head { display: flex; align-items: center; gap: 10px; padding: 16px 18px 12px; border-bottom: 1px solid var(--rule); }
.drawer-title { font-family: var(--font-display); font-size: 17px; font-weight: 700; }
#drawer-stats { font-size: 11px; color: var(--ink-ghost); margin-right: auto; }
#drawer .close { position: static; flex-shrink: 0; }
#drawer-search {
  margin: 12px 18px 0;
  border: 1px solid var(--rule-dark);
  border-radius: 99px;
  padding: 7px 14px;
  font-family: var(--font-ui);
  font-size: 13px;
  background: var(--paper);
  color: var(--ink);
  outline: none;
}
#drawer-search:focus { border-color: var(--accent); }
#drawer-legend { padding: 12px 18px; border-bottom: 1px solid var(--rule); }
.legend-row { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--ink-soft); padding: 2px 0; }
.legend-count { margin-left: auto; font-size: 10px; color: var(--ink-ghost); }
#drawer-list { flex: 1; overflow-y: auto; padding: 8px 10px; scrollbar-width: thin; }
.drawer-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 9px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--ink-soft);
  cursor: pointer;
}
.drawer-item:hover { background: var(--paper); color: var(--ink); }
.drawer-item.sel { background: var(--paper); color: var(--ink); font-weight: 600; }

/* ── Responsive ── */
@media (max-width: 1100px) { .tagline { display: none; } }

@media (max-width: 768px) {
  header { gap: 10px; padding: 11px 14px; }
  header h1 { font-size: 18px; }
  .search-wrap { width: auto; flex: 1; min-width: 0; }
  .kbd { display: none; }
  .figures-btn { padding: 8px 12px; }
  .rail { padding: 8px 14px; }

  #welcome {
    left: 16px;
    right: 16px;
    bottom: 16px;
    width: auto;
  }

  #profile {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 55vh;
    border-radius: 16px 16px 0 0;
    border: none;
    border-top: 1px solid var(--rule);
    transition: height 0.25s ease;
  }
  #profile.full { height: 92vh; }
  .sheet-handle {
    display: block;
    width: 36px;
    height: 4px;
    border-radius: 99px;
    background: var(--rule-dark);
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
  }
  .profile-head { padding: 22px 20px 12px; }
  .pbody { padding: 18px 20px 40px; }

  #drawer { width: 100%; border-left: none; }
  #conn-badge { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
}
```

- [ ] **Step 2: Commit**

```bash
git add css/styles.css
git commit -m "feat: add Light Editorial stylesheet

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: New index.html shell

**Files:**
- Modify: `index.html` (full replacement of contents)

- [ ] **Step 1: Replace index.html with the shell**

The site will be broken (blank graph) until Task 6 lands — expected on this branch. Complete file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Who Made AI? — An Atlas of the People Behind the Machines</title>
<meta name="description" content="An interactive atlas of the 114 people who shaped artificial intelligence — from Turing to today.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=Inter:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/styles.css">
</head>
<body>

<header>
  <h1>Who Made <em>AI?</em></h1>
  <span class="tagline">An atlas of the people behind the machines</span>
  <div class="search-wrap">
    <span aria-hidden="true">⌕</span>
    <input type="text" id="search" placeholder="Search figures…" autocomplete="off">
    <span class="kbd">/</span>
  </div>
  <button id="figures-btn" class="figures-btn">☰ All figures</button>
</header>

<div class="rail" id="topic-rail">
  <span class="rail-label">TOPICS</span>
</div>

<div class="stage" id="stage">
  <svg id="graph">
    <g id="zoom-root">
      <g id="links-layer"></g>
      <g id="nodes-layer"></g>
    </g>
  </svg>

  <div id="hover-card" hidden></div>
  <div id="conn-badge" hidden></div>

  <div class="zoom">
    <button id="zoom-in" aria-label="Zoom in">+</button>
    <button id="zoom-out" aria-label="Zoom out">−</button>
    <button id="zoom-reset" aria-label="Reset view">⌂</button>
  </div>

  <div id="welcome" hidden>
    <div class="kicker">WELCOME TO THE ATLAS</div>
    <h2 id="welcome-count">114 people. One revolution.</h2>
    <p>Every dot is a person who shaped artificial intelligence. Lines connect people who work on the same ideas. Tap any figure to read their story.</p>
    <div class="legend" id="welcome-legend"></div>
    <button class="cta" id="welcome-cta">Start exploring</button><button class="dismiss" id="welcome-never">Don't show again</button>
  </div>

  <aside id="profile" hidden>
    <div class="profile-head">
      <div class="sheet-handle" aria-hidden="true"></div>
      <div id="profile-kicker"></div>
      <h2 id="profile-name"></h2>
      <div id="profile-role"></div>
      <button class="close" id="profile-close" aria-label="Close profile">✕</button>
    </div>
    <nav class="ptabs" id="profile-tabs"></nav>
    <div class="pbody" id="profile-body"></div>
  </aside>

  <div id="drawer-scrim" hidden></div>
  <aside id="drawer" hidden>
    <div class="drawer-head">
      <span class="drawer-title">All figures</span>
      <span id="drawer-stats"></span>
      <button class="close" id="drawer-close" aria-label="Close list">✕</button>
    </div>
    <input id="drawer-search" placeholder="Filter by name…" autocomplete="off">
    <div id="drawer-legend"></div>
    <div id="drawer-list"></div>
  </aside>
</div>

<!-- Pinned versions + SRI: hashes are inserted in Step 2 of this task. -->
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"
        integrity="sha384-REPLACED_IN_STEP_2" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"
        integrity="sha384-REPLACED_IN_STEP_2" crossorigin="anonymous"></script>
<script src="data/figures-data.js"></script>
<script src="data/research-data.js"></script>
<script src="data/summaries-data.js"></script>
<script src="js/profile-sections.js"></script>
<script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Compute and insert SRI hashes for the pinned CDN scripts**

The redesign pins exact versions (`d3@7.9.0`, `marked@9.1.6`) so Subresource Integrity hashes are stable — the old site used a floating `d3.v7.min.js` URL, which cannot be integrity-pinned. Compute each hash and replace the two `sha384-REPLACED_IN_STEP_2` values:

```bash
curl -sL https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js | openssl dgst -sha384 -binary | openssl base64 -A
curl -sL https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```

Each command prints a base64 string; the attribute value is `sha384-<that string>`. (The Google Fonts `<link>` cannot use SRI — its CSS response varies per browser — and loads no executable script; this is the accepted norm.)

Sanity-check in the next browser run: if either hash were wrong, the script is blocked and the console shows an integrity error; D3 not loading means no graph, so a wrong hash cannot slip through Task 6 Step 4's verification.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: replace index.html with Atlas App shell

Site is intentionally non-functional until js/app.js lands (next commit).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: app.js — core graph, rail, search, selection, zoom

**Files:**
- Create: `js/app.js`

This task ends with a working graph (no drawer/profile/welcome yet — those are temporary stubs replaced in Task 7).

- [ ] **Step 1: Write sections 1–5 (theme overrides, derived data, state, header, rail)**

Create `js/app.js` with:

```js
// Who Made AI? — Atlas App behavior (Light Editorial redesign).
// Depends on globals loaded before this script: d3, marked, DOMAINS, TOPICS,
// PEOPLE, BIOS, RESEARCH, SUMMARIES, ProfileSections.
"use strict";

// ═══ 1. LIGHT-THEME COLOR OVERRIDES ═══
// figures-data.js keeps the original dark-theme colors verbatim; ALL
// light-background re-tuning lives here, in one place (design spec § colors).

const DOMAIN_COLORS_LIGHT = {
  historical: "#a16207",
  research:   "#2563eb",
  industry:   "#d97706",
  safety:     "#be123c",
  ethics:     "#0f766e",
  policy:     "#7c3aed",
};

const TOPIC_COLORS_LIGHT = {
  llms: "#dc2626",            nlp: "#ea580c",             transformers: "#ca8a04",
  computer_vision: "#16a34a", generative_ai: "#0284c7",   deep_learning: "#2563eb",
  reinforcement_learning: "#d97706", robotics: "#0f766e", ai_safety: "#be123c",
  ai_ethics: "#059669",       agi: "#c2410c",             ai_policy: "#0369a1",
  foundation_models: "#a16207", ai_hardware: "#0e7490",   causal_ai: "#9333ea",
  medical_ai: "#0d9488",      ml_education: "#b45309",    autonomous_vehicles: "#b91c1c",
  game_ai: "#7c3aed",         meta_learning: "#15803d",   symbolic_ai: "#92400e",
  cybernetics: "#155e75",     cognitive_sci: "#6d28d9",   hci: "#c026d3",
  open_source_ai: "#047857",
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

Object.entries(DOMAIN_COLORS_LIGHT).forEach(([id, color]) => {
  if (DOMAINS[id]) { DOMAINS[id].color = color; DOMAINS[id].rgb = hexToRgb(color); }
});
TOPICS.forEach(t => {
  const c = TOPIC_COLORS_LIGHT[t.id];
  if (c) { t.color = c; t.rgb = hexToRgb(c); }
});

// ═══ 2. DERIVED DATA (same model as the original site) ═══
const topicById = Object.fromEntries(TOPICS.map(t => [t.id, t]));
const nodeById = Object.fromEntries(PEOPLE.map(p => [p.id, p]));

function computeEdges(people) {
  const out = [];
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i], b = people[j];
      const shared = a.topics.filter(t => b.topics.includes(t));
      if (shared.length > 0) {
        out.push({ source: a.id, target: b.id, topics: shared, weight: shared.length });
      }
    }
  }
  return out;
}
const allEdges = computeEdges(PEOPLE);

const topicMembers = {};
TOPICS.forEach(t => { topicMembers[t.id] = new Set(); });
PEOPLE.forEach(p => p.topics.forEach(tid => {
  if (topicMembers[tid]) topicMembers[tid].add(p.id);
}));

function getNeighborIds(nodeId) {
  const ids = new Set([nodeId]);
  allEdges.forEach(e => {
    if (e.source === nodeId) ids.add(e.target);
    if (e.target === nodeId) ids.add(e.source);
  });
  return ids;
}

function neighborsByWeight(nodeId) {
  return allEdges
    .filter(e => e.source === nodeId || e.target === nodeId)
    .map(e => ({ id: e.source === nodeId ? e.target : e.source, weight: e.weight }))
    .sort((a, b) => b.weight - a.weight);
}

// ═══ 3. STATE & HELPERS ═══
let activeTopics = new Set();
let hoveredNode = null;
let selectedNode = null;
let searchQuery = "";
let zoomBehavior;

const isTouch = window.matchMedia("(pointer: coarse)").matches;
const isMobile = () => window.matchMedia("(max-width: 768px)").matches;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FLY_MS = reducedMotion ? 0 : 650;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ═══ 4. HEADER: search + keyboard ═══
const searchInput = document.getElementById("search");

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== searchInput && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    searchInput.focus();
  }
  if (e.key === "Escape") {
    if (!document.getElementById("drawer").hidden) closeDrawer();
    else if (selectedNode) clearNodeSelection();
    else hideWelcome(false);
  }
});

searchInput.addEventListener("input", function () {
  searchQuery = this.value.toLowerCase().trim();
  applySearchDim();
  renderLinks();
});

function getOpacity(d) {
  if (!searchQuery) return 0.92;
  return d.name.toLowerCase().includes(searchQuery) ? 1 : 0.12;
}

function applySearchDim() {
  nodeGroups.select(".main-circle").attr("fill-opacity", d => getOpacity(d));
  nodeGroups.select(".node-label").attr("opacity", d =>
    (!searchQuery || d.name.toLowerCase().includes(searchQuery)) ? 1 : 0.15);
}

// ═══ 5. TOPIC RAIL ═══
const railEl = document.getElementById("topic-rail");
const allChip = el("button", "chip on", "All");
allChip.addEventListener("click", () => {
  activeTopics.clear();
  updateChips(); renderLinks(); updateBadge();
});
railEl.appendChild(allChip);

TOPICS.forEach(topic => {
  const chip = el("button", "chip");
  chip.dataset.topicId = topic.id;
  const dot = el("span", "dot");
  dot.style.background = topic.color;
  chip.append(dot, el("span", null, topic.label),
    el("span", "chip-count", String(topicMembers[topic.id].size)));
  chip.addEventListener("click", () => toggleTopic(topic.id));
  railEl.appendChild(chip);
});

function toggleTopic(id) {
  activeTopics.has(id) ? activeTopics.delete(id) : activeTopics.add(id);
  updateChips(); renderLinks(); updateBadge();
}

function updateChips() {
  allChip.classList.toggle("on", activeTopics.size === 0);
  railEl.querySelectorAll(".chip[data-topic-id]").forEach(chip =>
    chip.classList.toggle("on", activeTopics.has(chip.dataset.topicId)));
}
```

- [ ] **Step 2: Append sections 6–10 (simulation, nodes, links, hover, badge, selection, zoom, resize)**

```js
// ═══ 6. D3 SIMULATION & NODES ═══ (same force model, printed-infographic styling)
const svg = d3.select("#graph");
const zoomRoot = svg.select("#zoom-root");
const linksLayer = svg.select("#links-layer");
const nodesLayer = svg.select("#nodes-layer");

const CLUSTER = {
  historical: [0.16, 0.40],
  research:   [0.34, 0.46],
  industry:   [0.62, 0.34],
  safety:     [0.46, 0.16],
  ethics:     [0.26, 0.70],
  policy:     [0.66, 0.68],
};

let W = 800, H = 600;
function getDims() {
  const c = document.getElementById("stage");
  return [c.clientWidth, c.clientHeight];
}
[W, H] = getDims();

const radiusOf = d => 6 + (d.size - 5) * 2;

PEOPLE.forEach(p => {
  const pos = CLUSTER[p.domain] || [0.5, 0.5];
  p.x = pos[0] * W + (Math.random() - 0.5) * 100;
  p.y = pos[1] * H + (Math.random() - 0.5) * 100;
  p.vx = 0; p.vy = 0;
});

function clusterForce(strength) {
  return () => {
    PEOPLE.forEach(p => {
      const pos = CLUSTER[p.domain] || [0.5, 0.5];
      p.vx += (pos[0] * W - p.x) * strength;
      p.vy += (pos[1] * H - p.y) * strength;
    });
  };
}

const simulation = d3.forceSimulation(PEOPLE)
  .force("charge", d3.forceManyBody().strength(d => -180 - d.size * 15))
  .force("center", d3.forceCenter(W / 2, H / 2).strength(0.03))
  .force("collide", d3.forceCollide(d => radiusOf(d) + 14).strength(0.7))
  .force("cluster", clusterForce(0.03))
  .on("tick", ticked);

const nodeGroups = nodesLayer.selectAll(".node")
  .data(PEOPLE, d => d.id)
  .enter()
  .append("g")
  .attr("class", "node")
  .call(
    d3.drag()
      .filter(ev => !isTouch && !ev.ctrlKey && !ev.button) // spec: no node drag on touch — pan/pinch win
      .on("start", (ev, d) => { if (!ev.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag",  (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
      .on("end",   (ev, d) => { if (!ev.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
  )
  .on("mouseover", onNodeHover)
  .on("mouseout",  onNodeOut)
  .on("click",     onNodeClick);

nodeGroups.append("circle")
  .attr("class", "main-circle")
  .attr("r", d => radiusOf(d))
  .attr("fill", d => DOMAINS[d.domain] ? DOMAINS[d.domain].color : "#8a8377")
  .attr("fill-opacity", 0.92)
  .attr("stroke", "#fffdf9")
  .attr("stroke-width", 2.5);

nodeGroups.each(function (d) {
  d3.select(this).append("text")
    .attr("class", "node-label")
    .attr("y", radiusOf(d) + 13)
    .text(d.name.split(" ").pop());
});

function ticked() {
  nodeGroups.attr("transform", d => `translate(${d.x},${d.y})`);
  renderLinks();
}

// ═══ 7. LINKS ═══ (same focus model: hovered > selected > active topics)
function renderLinks() {
  linksLayer.selectAll("*").remove();
  const focusNode = hoveredNode || selectedNode;
  if (activeTopics.size === 0 && !focusNode) return;

  let edges, isNodeFocus = false;
  if (focusNode) {
    edges = allEdges.filter(e => e.source === focusNode.id || e.target === focusNode.id);
    isNodeFocus = true;
  } else {
    edges = allEdges.filter(e => e.topics.some(t => activeTopics.has(t)));
  }

  edges.forEach(e => {
    const sa = nodeById[e.source], ta = nodeById[e.target];
    if (!sa || !ta) return;
    if (searchQuery) {
      const am = sa.name.toLowerCase().includes(searchQuery);
      const bm = ta.name.toLowerCase().includes(searchQuery);
      if (!am && !bm) return;
    }
    const pickTopic = e.topics.find(t => activeTopics.has(t)) || e.topics[0];
    const ti = topicById[pickTopic] || { color: "#c9c2b4" };
    linksLayer.append("line")
      .attr("class", "link")
      .attr("x1", sa.x).attr("y1", sa.y)
      .attr("x2", ta.x).attr("y2", ta.y)
      .attr("stroke", ti.color)
      .attr("stroke-width", 0.8 + e.weight * 0.4)
      .attr("stroke-opacity", isNodeFocus ? 0.65 : 0.45);
  });
}

// ═══ 8. HOVER CARD & CONNECTION BADGE ═══
const hoverCard = document.getElementById("hover-card");

function fillHoverCard(d, withButton) {
  while (hoverCard.firstChild) hoverCard.removeChild(hoverCard.firstChild);
  const dom = DOMAINS[d.domain];
  const kick = el("div", "hc-kicker", dom ? dom.label : "");
  if (dom) kick.style.color = dom.color;
  hoverCard.append(kick, el("div", "hc-name", d.name),
    el("div", "hc-role", d.role + " · " + d.org));
  if (withButton) {
    const btn = el("button", "hc-btn", "Read profile →");
    btn.addEventListener("click", (ev) => { ev.stopPropagation(); openProfileFor(d); });
    hoverCard.appendChild(btn);
  }
}

function placeHoverCard(clientX, clientY) {
  const stage = document.getElementById("stage").getBoundingClientRect();
  hoverCard.style.left = "0px"; hoverCard.style.top = "0px"; // reset before measuring
  const r = hoverCard.getBoundingClientRect();
  let left = clientX - stage.left + 14;
  let top  = clientY - stage.top + 14;
  left = Math.max(8, Math.min(left, stage.width - r.width - 12));
  top  = Math.max(8, Math.min(top, stage.height - r.height - 12));
  hoverCard.style.left = left + "px";
  hoverCard.style.top = top + "px";
}

function onNodeHover(event, d) {
  if (isTouch) return;
  hoveredNode = d;
  renderLinks();
  d3.select(this).select(".main-circle").transition().duration(100).attr("r", radiusOf(d) * 1.3);
  fillHoverCard(d, false);
  hoverCard.hidden = false;
  placeHoverCard(event.clientX, event.clientY);
}

function onNodeOut(event, d) {
  if (isTouch) return;
  hoveredNode = null;
  renderLinks();
  hoverCard.hidden = true;
  const isSel = selectedNode && selectedNode.id === d.id;
  d3.select(this).select(".main-circle").transition().duration(150)
    .attr("r", isSel ? radiusOf(d) * 1.25 : radiusOf(d));
}

function updateBadge() {
  const badge = document.getElementById("conn-badge");
  if (activeTopics.size === 0) { badge.hidden = true; return; }
  const count = allEdges.filter(e => e.topics.some(t => activeTopics.has(t))).length;
  badge.textContent = count + " connections — " +
    [...activeTopics].map(t => topicById[t] ? topicById[t].label : t).join(" · ");
  badge.hidden = false;
}

// ═══ 9. SELECTION ═══
function onNodeClick(event, d) {
  event.stopPropagation();
  hideWelcome(false);
  if (selectedNode && selectedNode.id === d.id) {
    // Touch: second tap on the selected node opens the sheet.
    if (isTouch && document.getElementById("profile").hidden) { openProfileFor(d); return; }
    clearNodeSelection();
    return;
  }
  if (isTouch) {
    selectNode(d, { openProfile: false }); // first tap: highlight + callout only
    fillHoverCard(d, true);
    hoverCard.hidden = false;
    placeHoverCard(event.clientX, event.clientY);
  } else {
    selectNode(d, { openProfile: true });
  }
}

function selectNode(d, opts) {
  selectedNode = d;
  renderLinks();
  applySelectionHighlight();
  refreshDrawerList();
  if (opts && opts.openProfile) openProfileFor(d);
}

function clearNodeSelection() {
  selectedNode = null;
  hoverCard.hidden = true;
  closeProfile();
  renderLinks();
  applySelectionHighlight();
  refreshDrawerList();
}

function applySelectionHighlight() {
  if (!selectedNode) {
    nodeGroups.select(".main-circle").transition().duration(200)
      .attr("r", d => radiusOf(d))
      .attr("fill-opacity", d => getOpacity(d))
      .attr("stroke", "#fffdf9");
    nodeGroups.select(".node-label").transition().duration(200).attr("opacity", 1);
    return;
  }
  const related = getNeighborIds(selectedNode.id);
  nodeGroups.select(".main-circle").transition().duration(200)
    .attr("r", d => d.id === selectedNode.id ? radiusOf(d) * 1.25 : radiusOf(d))
    .attr("fill-opacity", d => d.id === selectedNode.id ? 1 : (related.has(d.id) ? 0.92 : 0.15))
    .attr("stroke", d => d.id === selectedNode.id ? "#1a1a1a" : "#fffdf9");
  nodeGroups.select(".node-label").transition().duration(200)
    .attr("opacity", d => related.has(d.id) ? 1 : 0.15);
}

function flyTo(d) {
  const [cw, ch] = getDims();
  const scale = 2.2;
  svg.transition().duration(FLY_MS).call(zoomBehavior.transform,
    d3.zoomIdentity.translate(cw / 2 - d.x * scale, ch / 2 - d.y * scale).scale(scale));
}

svg.on("click.deselect", (event) => {
  if (event.target.closest(".node")) return;
  hideWelcome(false);
  if (selectedNode) clearNodeSelection();
  else hoverCard.hidden = true;
});

// ═══ 10. ZOOM & RESIZE ═══
zoomBehavior = d3.zoom()
  .scaleExtent([0.25, 5])
  .on("zoom", ev => zoomRoot.attr("transform", ev.transform));
svg.call(zoomBehavior);

document.getElementById("zoom-in").addEventListener("click",
  () => svg.transition().call(zoomBehavior.scaleBy, 1.4));
document.getElementById("zoom-out").addEventListener("click",
  () => svg.transition().call(zoomBehavior.scaleBy, 0.7));
document.getElementById("zoom-reset").addEventListener("click",
  () => svg.transition().call(zoomBehavior.transform, d3.zoomIdentity));

window.addEventListener("resize", () => {
  [W, H] = getDims();
  simulation.force("center", d3.forceCenter(W / 2, H / 2).strength(0.03));
  simulation.alpha(0.25).restart();
});
```

- [ ] **Step 3: Append TEMPORARY stubs (deleted in Task 7)**

```js
// ─── TEMPORARY STUBS — replaced wholesale in Task 7 ───
function openProfileFor(d) {}
function closeProfile() {}
function refreshDrawerList() {}
function closeDrawer() {}
function hideWelcome(forever) {}
```

- [ ] **Step 4: Verify the core experience in a browser**

Run: `npx wrangler dev` → http://localhost:8787
Checklist (desktop): paper-toned page, serif node labels, white-stroked colored nodes clustered by domain; hover shows the hover card + connection lines; topic chips toggle (active = ink pill) and draw colored links; "All" chip clears; connection badge appears with topics active; search dims non-matches; `/` focuses search; zoom buttons, wheel-zoom, pan, node drag all work; clicking a node highlights it + dims others (profile won't open yet — stubbed). No console errors.

- [ ] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "feat: Atlas App core — graph, topic rail, search, selection, zoom

Drawer, profile, and welcome card are stubbed; next commit completes them.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: app.js — drawer, profile paper page, welcome card, mobile sheet

**Files:**
- Modify: `js/app.js` (delete the 5 stub functions; append sections 11–14)

- [ ] **Step 1: Delete the temporary stub block**

Remove the entire `─── TEMPORARY STUBS ───` block (the 5 one-line functions) from the end of `js/app.js`.

- [ ] **Step 2: Append section 11 (figures drawer)**

```js
// ═══ 11. FIGURES DRAWER ═══
const drawerEl = document.getElementById("drawer");
const drawerScrim = document.getElementById("drawer-scrim");
const drawerList = document.getElementById("drawer-list");
const drawerSearch = document.getElementById("drawer-search");

document.getElementById("drawer-stats").textContent =
  PEOPLE.length + " people · " + TOPICS.length + " topics";

const legendEl = document.getElementById("drawer-legend");
Object.entries(DOMAINS).forEach(([id, dom]) => {
  const count = PEOPLE.filter(p => p.domain === id).length;
  const row = el("div", "legend-row");
  const dot = el("span", "dot");
  dot.style.background = dom.color;
  row.append(dot, el("span", null, dom.label), el("span", "legend-count", String(count)));
  legendEl.appendChild(row);
});

const sortedPeople = [...PEOPLE].sort((a, b) =>
  a.name.split(" ").pop().localeCompare(b.name.split(" ").pop()));

sortedPeople.forEach(p => {
  const item = el("div", "drawer-item");
  item.dataset.pid = p.id;
  const dot = el("span", "dot");
  dot.style.background = DOMAINS[p.domain] ? DOMAINS[p.domain].color : "#8a8377";
  item.append(dot, el("span", null, p.name));
  item.addEventListener("click", () => {
    closeDrawer();
    const d = nodeById[p.id];
    selectNode(d, { openProfile: true });
    flyTo(d);
  });
  drawerList.appendChild(item);
});

function openDrawer() {
  drawerEl.hidden = false;
  drawerScrim.hidden = false;
  drawerSearch.value = "";
  refreshDrawerList();
  if (!isTouch) drawerSearch.focus();
}
function closeDrawer() {
  drawerEl.hidden = true;
  drawerScrim.hidden = true;
}
document.getElementById("figures-btn").addEventListener("click", openDrawer);
document.getElementById("drawer-close").addEventListener("click", closeDrawer);
drawerScrim.addEventListener("click", closeDrawer);
drawerSearch.addEventListener("input", refreshDrawerList);

// Text filter + selection filter combined (parity with the old people panel:
// an active selection narrows the list to the selection + its neighbors).
function refreshDrawerList() {
  const q = drawerSearch.value.toLowerCase().trim();
  const related = selectedNode ? getNeighborIds(selectedNode.id) : null;
  drawerList.querySelectorAll(".drawer-item").forEach(item => {
    const p = nodeById[item.dataset.pid];
    const show = (!q || p.name.toLowerCase().includes(q)) && (!related || related.has(p.id));
    item.style.display = show ? "" : "none";
    item.classList.toggle("sel", !!selectedNode && p.id === selectedNode.id);
  });
}
```

- [ ] **Step 3: Append section 12 (profile paper page)**

```js
// ═══ 12. PROFILE PAPER PAGE ═══
const profileEl = document.getElementById("profile");
const tabsEl = document.getElementById("profile-tabs");
const bodyEl = document.getElementById("profile-body");
let currentPerson = null;
let currentTabs = [];

function openProfileFor(d) {
  hoverCard.hidden = true;
  currentPerson = d;
  const dom = DOMAINS[d.domain];

  const kicker = document.getElementById("profile-kicker");
  kicker.textContent = "RESEARCH PROFILE · " + (dom ? dom.label.toUpperCase() : "");
  kicker.style.color = dom ? dom.color : "var(--accent)";
  document.getElementById("profile-name").textContent = d.name;
  document.getElementById("profile-role").textContent =
    d.role + (d.org ? " · " + d.org : "");

  const md = (typeof RESEARCH !== "undefined" && RESEARCH[d.id]) ? RESEARCH[d.id] : null;
  const sections = md ? ProfileSections.parseSections(md) : [];
  currentTabs = ProfileSections.mapSectionsToTabs(sections,
    t => console.warn('Unmapped profile section "' + t + '" for ' + d.id));

  while (tabsEl.firstChild) tabsEl.removeChild(tabsEl.firstChild);
  currentTabs.forEach((t, i) => {
    const b = el("button", "ptab" + (i === 0 ? " on" : ""), t.tab);
    b.addEventListener("click", () => activateTab(i));
    tabsEl.appendChild(b);
  });

  activateTab(0);
  profileEl.hidden = false;
  profileEl.classList.remove("full"); // mobile sheet opens at peek height
}

function activateTab(i) {
  tabsEl.querySelectorAll(".ptab").forEach((b, bi) => b.classList.toggle("on", bi === i));
  const d = currentPerson;
  const t = currentTabs[i];
  while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);

  if (t.tab === "Overview") {
    const ledeText =
      (typeof SUMMARIES !== "undefined" && SUMMARIES[d.id]) ? SUMMARIES[d.id] :
      (typeof BIOS !== "undefined" && BIOS[d.id]) ? BIOS[d.id] : null;
    if (ledeText) bodyEl.appendChild(el("div", "lede", ledeText));
    if (t.sections.length === 0 && (typeof RESEARCH === "undefined" || !RESEARCH[d.id])) {
      bodyEl.appendChild(el("p", "muted", "Full research profile not available for this figure."));
    }
  }

  t.sections.forEach(s => {
    bodyEl.appendChild(el("h3", null, s.title));
    const div = el("div", "md");
    if (typeof marked !== "undefined") div.innerHTML = marked.parse(s.body);
    else div.textContent = s.body;
    bodyEl.appendChild(div);
  });

  if (t.tab === "Overview") appendConnected(d);
  bodyEl.scrollTop = 0;
}

function appendConnected(d) {
  const ns = neighborsByWeight(d.id).slice(0, 8);
  if (!ns.length) return;
  bodyEl.appendChild(el("h3", null, "Connected figures"));
  const wrap = el("div", "conn");
  ns.forEach(n => {
    const p = nodeById[n.id];
    if (!p) return;
    const chipBtn = el("button", "conn-chip");
    const dot = el("span", "dot");
    dot.style.background = DOMAINS[p.domain] ? DOMAINS[p.domain].color : "#8a8377";
    chipBtn.append(dot, el("span", null, p.name));
    chipBtn.addEventListener("click", () => {
      selectNode(p, { openProfile: true });
      flyTo(p);
    });
    wrap.appendChild(chipBtn);
  });
  bodyEl.appendChild(wrap);
}

function closeProfile() {
  profileEl.hidden = true;
  profileEl.classList.remove("full");
}
document.getElementById("profile-close").addEventListener("click", () => clearNodeSelection());
```

- [ ] **Step 4: Append sections 13–14 (mobile sheet drag, welcome card)**

```js
// ═══ 13. MOBILE BOTTOM SHEET ═══
// Drag the sheet header: up past 60px → full height; down past 80px → peek
// (from full) or close (from peek); otherwise snap back.
let sheetDrag = null;
const sheetHead = profileEl.querySelector(".profile-head");

sheetHead.addEventListener("touchstart", (e) => {
  if (!isMobile()) return;
  sheetDrag = { y: e.touches[0].clientY, dy: 0 };
}, { passive: true });

sheetHead.addEventListener("touchmove", (e) => {
  if (!sheetDrag) return;
  sheetDrag.dy = e.touches[0].clientY - sheetDrag.y;
  profileEl.style.transform = "translateY(" + Math.max(-40, sheetDrag.dy) + "px)";
}, { passive: true });

sheetHead.addEventListener("touchend", () => {
  if (!sheetDrag) return;
  const dy = sheetDrag.dy;
  sheetDrag = null;
  profileEl.style.transform = "";
  if (dy < -60) profileEl.classList.add("full");
  else if (dy > 80) {
    if (profileEl.classList.contains("full")) profileEl.classList.remove("full");
    else clearNodeSelection();
  }
}, { passive: true });

// ═══ 14. WELCOME CARD ═══
const welcomeEl = document.getElementById("welcome");
const WELCOME_KEY = "wmai.welcome.dismissed";

document.getElementById("welcome-count").textContent =
  PEOPLE.length + " people. One revolution.";

const wLegend = document.getElementById("welcome-legend");
Object.values(DOMAINS).forEach(dom => {
  const s = el("span");
  const i = el("i");
  i.style.background = dom.color;
  s.append(i, document.createTextNode(dom.label));
  wLegend.appendChild(s);
});

function maybeShowWelcome() {
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(WELCOME_KEY) === "1" ||
                sessionStorage.getItem(WELCOME_KEY) === "1";
  } catch (e) { /* storage unavailable (private mode): show every visit */ }
  if (!dismissed) welcomeEl.hidden = false;
}

function hideWelcome(forever) {
  if (welcomeEl.hidden) return;
  welcomeEl.hidden = true;
  try {
    (forever ? localStorage : sessionStorage).setItem(WELCOME_KEY, "1");
  } catch (e) { /* ignore */ }
}

document.getElementById("welcome-cta").addEventListener("click", () => hideWelcome(false));
document.getElementById("welcome-never").addEventListener("click", () => hideWelcome(true));
maybeShowWelcome();
```

- [ ] **Step 5: Run the Node tests (regression)**

Run: `node --test tests/` then `node tests/all-profiles-smoke.cjs`
Expected: all unit tests pass; `Checked 114 profiles — 0 failure(s).`

- [ ] **Step 6: Verify full flows in a browser**

Run: `npx wrangler dev` → http://localhost:8787
Checklist (desktop): welcome card shows with legend; "Start exploring" hides it (reappears in a new tab; gone after "Don't show again" + reload); clicking a node opens the paper page with kicker/name/role, lede, tabs (Overview/Research/Positions/Media/Values/Criticism), markdown tables/blockquotes styled; tab switching works; "Connected figures" chips jump between profiles with fly-to; ✕ and Esc and stage-click deselect; "All figures" opens drawer (legend, counts, filter input works); drawer item click flies to person and opens profile; with a selection active the drawer shows only selection + neighbors. No console errors, zero unmapped-section warnings while clicking through several profiles.

- [ ] **Step 7: Commit**

```bash
git add js/app.js
git commit -m "feat: figures drawer, tabbed profile page, welcome card, mobile sheet

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Mobile pass + deploy hygiene

**Files:**
- Create: `.assetsignore`
- Modify: `js/app.js` / `css/styles.css` only if the checklist below finds issues

- [ ] **Step 1: Mobile emulation checklist**

In Chrome DevTools device mode (iPhone SE 375×667 and Pixel 7), against `npx wrangler dev`:
- Welcome card spans the bottom, dismiss works.
- First tap on a node: highlight + callout with "Read profile →"; tapping the button (or the node again) opens the bottom sheet at ~55vh.
- Sheet: drag handle visible; drag up → full (92vh); drag down → peek → closed; ✕ works.
- Tabs scroll horizontally in the sheet; content scrolls.
- Chip rail swipes horizontally; chips toggle.
- Graph: one-finger pan and two-finger pinch zoom work and do NOT scroll/bounce the page (`touch-action: none`); node drag is disabled.
- Drawer opens full-screen; filter + tap-through work.
- Header doesn't overflow (tagline hidden, search shrinks).

Fix anything broken (CSS first; JS only if behavior is wrong). Each fix: re-test, then amendless follow-up commit (`fix: <what>` + co-author line).

- [ ] **Step 2: Desktop parity re-check (spec § Verification, item 1)**

Full pass of the desktop checklist from Task 6 Step 4 + Task 7 Step 6 on the final code.

- [ ] **Step 3: Create `.assetsignore`**

Keeps non-site files out of the deployed Cloudflare Workers assets:

```
docs/
tests/
.superpowers/
README.md
```

- [ ] **Step 4: Verify ignored assets**

Run: `npx wrangler dev`, then confirm http://localhost:8787/tests/all-profiles-smoke.cjs returns 404 while http://localhost:8787/data/research-data.js still returns 200.

- [ ] **Step 5: Commit**

```bash
git add .assetsignore
git commit -m "chore: exclude docs/tests from deployed assets

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Branch handoff

- [ ] **Step 1: Final test run**

Run: `node --test tests/ && node tests/all-profiles-smoke.cjs`
Expected: everything green.

- [ ] **Step 2: Push and preview**

```bash
git push -u origin redesign/light-editorial
```

Cloudflare's git integration builds a preview deployment for the branch. Open the preview URL (Cloudflare dashboard → Workers & Pages → who-made-ai → deployments) and spot-check desktop + a real phone (spec § Verification, items 3–5).

- [ ] **Step 3: Hand off for merge decision**

Use the superpowers:finishing-a-development-branch skill: present merge/PR options to the user. Do NOT merge to `main` without explicit user approval — `main` auto-deploys to production.

---

## Self-Review Notes

- **Spec coverage:** tokens/typography → Task 4; header/rail/stage/drawer → Tasks 5–7; tab mapping incl. tolerant matching + unmapped fallback → Tasks 2–3; lede/connected-figures → Task 7; welcome + localStorage → Task 7; touch/sheet/pinch → Tasks 6 (drag filter, touch-action) + 7 (sheet) + 8 (verification); reduced motion → Task 4 (CSS) + Task 6 (`FLY_MS`); stats computed not hardcoded → Tasks 5/7 (set from `PEOPLE.length`); error handling (missing data, storage) → Task 7; verification plan → Tasks 3, 6–9. Topic recolor table (spec open question) → resolved in Task 6 § `TOPIC_COLORS_LIGHT`.
- **Known intentional deviations:** one — the spec said "D3 v7 + marked.js v9 from the same CDNs"; the plan instead pins exact versions on jsdelivr (`d3@7.9.0`, `marked@9.1.6`) with SRI hashes, prompted by a security-hook warning during planning. Same libraries and major versions; strictly more secure.
- **Type consistency:** `selectNode(d, {openProfile})`, `refreshDrawerList()`, `openProfileFor(d)`, `closeProfile()`, `closeDrawer()`, `hideWelcome(forever)`, `flyTo(d)`, `neighborsByWeight(id)`, `ProfileSections.{parseSections, mapSectionsToTabs, TAB_ORDER}` — names match across Tasks 2, 6, 7 (stubs in Task 6 Step 3 use the exact Task 7 signatures).
