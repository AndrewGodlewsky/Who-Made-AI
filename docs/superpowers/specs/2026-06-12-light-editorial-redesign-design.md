# Design: Who Made AI? — Light Editorial Redesign ("Atlas App")

**Date:** 2026-06-12
**Status:** Approved
**Mockup:** `.superpowers/brainstorm/879-1781310465/content/atlas-final-v2.html` (approved by user)

---

## Overview

Reimagine the AI Figures Network site with a **Light Editorial** visual identity and an **Atlas App** structure. The site targets the curious general public, must work well on phones, and keeps the D3 force graph as the central experience. This is a rewrite of the presentation layer (HTML/CSS/JS); the data layer and graph logic are preserved.

Decisions locked in during brainstorming:

| Decision | Choice |
|---|---|
| Visual direction | Light Editorial — warm paper, serif type, printed-infographic nodes |
| Structure | Atlas App — graph IS the page; no scrolling landing page |
| Accent color | Blue `#2563eb` (user rejected burnt orange) |
| Audience | Curious general public — needs onboarding |
| Mobile | First-class: bottom sheets, touch-friendly, responsive |
| Scope | Full reimagining of presentation; data files untouched |

---

## Visual Language

### Design tokens (CSS custom properties)

```css
--paper: #faf7f2;        /* page background */
--paper-warm: #fffdf9;   /* cards, panels, graph center glow */
--ink: #1a1a1a;          /* headings, primary text, active chips */
--ink-soft: #44403a;     /* body text */
--ink-faint: #8a8377;    /* secondary text, taglines */
--ink-ghost: #a39b8b;    /* labels, placeholders */
--rule: #e2dccf;         /* hairline borders */
--rule-dark: #c9c2b4;    /* input borders, default edges */
--accent: #2563eb;       /* THE theme color: title "AI?", kickers, lede border, active tab */
```

### Domain colors (light-background tuned)

| Domain | Color |
|---|---|
| historical (Founders pre-1990) | `#a16207` ochre |
| research | `#2563eb` blue |
| industry | `#d97706` amber |
| safety | `#be123c` burgundy |
| ethics | `#0f766e` teal |
| policy | `#7c3aed` violet |

### Topic colors

The 25 existing topic hues are kept recognizable but re-tuned for legibility on paper: avoid neons and very light tones (e.g., `llms` `#FF6B6B` → `#dc2626`; `ai_hardware` `#A8DADC` → a mid-tone cyan). Implementation defines the full 25-entry mapping in one place; every topic color must pass a contrast sanity check against `--paper` for 1.5px edge lines.

### Typography (Google Fonts CDN)

| Font | Use |
|---|---|
| **Fraunces** (600–900, opsz) | Display: site title, profile names, welcome heading, pull quotes |
| **Source Serif 4** (400/600 + italic) | Reading: profile body, ledes, taglines, node labels |
| **Inter** (400–600) | UI: chips, tabs, buttons, search, section labels |

Node labels: Source Serif 4, white halo (`paint-order: stroke`, `--paper-warm` stroke) so they sit on edges cleanly. Nodes: domain-color fill, 2.5px `--paper-warm` stroke — the printed-infographic look.

---

## Layout & Structure

Single-screen app, no page scroll. Top to bottom:

### 1. Header (border-bottom: 2px solid `--ink`)
- **Title:** "Who Made *AI?*" — Fraunces 900; "AI?" italic in `--accent` blue.
- **Tagline:** "An atlas of the people behind the machines" — Source Serif italic, hidden below ~900px width.
- **Search:** pill input, right-aligned; `/` keyboard shortcut focuses it; live-filters graph (non-matching nodes dim to ~0.12 opacity) and the figures drawer list.
- **"All figures" button:** opens the Figures Drawer.
- Stats ("114 people · 25 topics") computed from `PEOPLE.length` / `TOPICS.length` — never hardcoded again. Shown in the figures drawer header.

### 2. Topic rail (replaces old topic sidebar)
- One horizontally scrollable row of pill chips: "All" + 25 topic chips, each with a color dot and label. Scrollbar hidden; drag/swipe to scroll.
- Click toggles a topic on/off (multi-select, same semantics as today). Active chip: ink background, paper text.
- "All" chip clears all active topics (replaces "Clear All Topics" button).
- Connection-count badge behavior survives: when topics are active, a small floating pill above the zoom controls reads "N connections — Topic · Topic".

### 3. Stage (graph canvas, fills remaining viewport)
- Background: subtle radial `--paper-warm` center over `--paper`.
- Same D3 v7 force simulation: charge, center, collide, domain cluster force. Cluster centroids may be re-tuned for the wider canvas (sidebar gone).
- Edges: default `--rule-dark`; colored by topic color when a topic filter or node focus applies. Same computed-edge model (`computeEdges`) and render-on-tick approach.
- Zoom controls: bottom-right, circular paper buttons (+ / − / ⌂ reset). Pan/zoom via d3.zoom as today.

### 4. Figures Drawer (replaces permanent people sidebar)
- Slide-over panel from the right (desktop ~320px; mobile full-screen overlay).
- Contents: count header, domain legend, search-filterable alphabetical list (last-name sort, domain dot per row — same as current `pp-list`).
- Click row → close drawer, select that person (fly-to + open profile). Esc or ✕ closes.
- When a node is selected, the drawer (if open) filters to the selection + neighbors, as the current people panel does.

---

## Profile "Paper Page" (replaces research panel)

Opens when a person is selected (node click or drawer click).

**Desktop:** floating card, right side, `width: min(560px, 46%)`, rounded, elevated shadow, slides/fades in 250ms.
**Mobile (≤768px):** bottom sheet with drag handle; opens at ~55% height "peek"; draggable to full-screen and dismissible by swipe-down or ✕.

### Header block
- Kicker line: "RESEARCH PROFILE · {DOMAIN LABEL}" in the person's domain color.
- Name: Fraunces 900, ~30px. Role + org as italic Source Serif line.
- ✕ close button (Esc also closes; clicking empty stage background also deselects — same as today).

### Tab navigation (replaces the TOC link list)
Profiles' existing markdown `##` sections map to six tabs:

| Tab | Markdown sections |
|---|---|
| Overview | summary lede (from `SUMMARIES`) + "Identity & Background" |
| Research | "Research & Technical Contributions" + "Published Works" |
| Positions | "Public Positions & Philosophy" |
| Media | "Media & Outreach" |
| Values | "Values" |
| Criticism | "Controversy & Criticism" |

- Section-heading matching is case-insensitive and tolerant of `&`/`and` variants.
- Any unmapped `##` section is appended to the **Overview** tab (with its heading rendered as an h3) and logged via `console.warn` so we notice data drift.
- A tab with no content for a given person is hidden.
- Active tab: `--accent` underline. Tabs scroll horizontally on mobile.
- Switching tabs swaps rendered content; scroll position resets to top.

### Body rendering
- Markdown rendered with marked.js (unchanged dependency). The "Catholics in Tech Podcast" subtitle line is still stripped.
- `SUMMARIES[id]` renders as the **lede**: larger Source Serif, `--accent` left border, top of Overview tab.
- Editorial styles for h3 (Inter uppercase labels), tables (hairline `--rule` borders), blockquotes (Fraunces italic pull-quote treatment: ink top border, rule bottom border), links (`--accent`).
- Fallback when `RESEARCH[id]` missing: same message as today, in the new styling; `BIOS[id]` shown if available.

### Connected figures row
- Bottom of the Overview tab: "Connected figures" — up to 8 neighbor chips (sorted by shared-topic weight, descending), each with the neighbor's domain dot.
- Clicking a chip selects that person: profile swaps, graph flies to them. This makes the network navigable by reading.

---

## Onboarding: Welcome Card

- Shown on load only if `localStorage["wmai.welcome.dismissed"]` is not set.
- Desktop: bottom-left card (~320px), `--accent` top border. Mobile: centered overlay with scrim.
- Content: kicker "WELCOME TO THE ATLAS" (accent blue), heading "114 people. One revolution." (count computed), two-sentence explanation (dots = people, lines = shared ideas, tap to read), 6-item domain legend grid, "Start exploring" CTA + "Don't show again".
- "Start exploring" closes for this visit (sessionStorage); "Don't show again" sets the localStorage flag permanently. Selecting any node also closes it.
- The domain legend also lives in the Figures Drawer, so dismissing the card doesn't lose the legend.

---

## Interactions & Touch

| Interaction | Desktop | Mobile |
|---|---|---|
| Inspect a person | Hover: node enlarges, connection lines show, compact name/role card appears near the node | First tap: same highlight + small name callout |
| Read a profile | Click node | Tap the callout's "Read profile" (or second tap on node) → bottom sheet |
| Deselect | Click empty stage / Esc / ✕ | Swipe sheet down / tap empty stage |
| Filter topics | Click chips | Tap chips (rail swipes horizontally) |
| Zoom | Buttons / wheel / drag | Pinch + drag; `touch-action: none` on the SVG so gestures don't fight page |
| Search | `/` to focus, type to dim non-matches | Tap search (header collapses gracefully) |
| Drag nodes | Drag (unchanged) | Long-press drag disabled (conflicts with pan) — pan/pinch win |

Breakpoint: 768px. Reduced motion: respect `prefers-reduced-motion` (skip fly-to animations and panel transitions).

---

## Technical Architecture

### File split (new)

```
index.html              ← markup shell only (~150 lines): header, rail, stage, drawer,
                          profile, welcome; <script>/<link> includes
css/styles.css          ← all styles, token-driven (`:root` variables)
js/app.js               ← all behavior: D3 sim, rendering, filters, profile, drawer,
                          welcome, touch handling
data/figures-data.js    ← PEOPLE, TOPICS, DOMAINS, BIOS moved verbatim from index.html
data/research-data.js   ← UNCHANGED
data/summaries-data.js  ← UNCHANGED
```

Load order: figures-data → research-data → summaries-data → app.js (all classic scripts/globals, same as today; no build step, no modules — keeps Cloudflare zero-config deploy).

### What is preserved verbatim
- `computeEdges` pairwise shared-topic edge model; topic/domain data shapes; person IDs.
- D3 v7 + marked.js v9 from the same CDNs.
- Safe-DOM construction (`el()` helper, `textContent`) for all UI we build; `marked.parse` → `innerHTML` only for trusted local research markdown, as today.
- All current features: search dimming, multi-topic filtering, connection badge, neighbor highlighting, drag, zoom/pan/reset, fly-to-node, graceful fallbacks for missing data.

### Explicitly out of scope
- Content changes (people, profiles, summaries, topics).
- Podcast branding, audio embeds, analytics.
- Build tooling, frameworks, bundlers.
- `wrangler.jsonc` / deployment changes (new folders are served automatically).
- Performance rework of per-tick link re-rendering (fine at 114 nodes; revisit only if it visibly lags on mobile during implementation testing).

---

## Error Handling & Edge Cases

- Missing `RESEARCH[id]` / `SUMMARIES[id]` / `BIOS[id]`: render what exists; never block the profile from opening.
- Unknown domain on a person: neutral gray node, center cluster (current fallback behavior, kept).
- CDN failure (fonts): system fallbacks declared (`Georgia, serif` / `system-ui`). CDN failure (D3/marked): same behavior as today (graph won't render / markdown shows as escaped pre text) — acceptable, unchanged risk.
- `localStorage` unavailable (private mode): welcome card simply shows each visit; no errors.
- Very long names/roles: ellipsis truncation in header block; full text in Overview body.

---

## Verification Plan

1. **Feature parity checklist** — every behavior in "What is preserved" exercised manually on desktop Chrome: search, each topic chip, multi-topic, clear-all, hover, select, deselect, drawer flows, zoom controls, fly-to, welcome dismiss persistence.
2. **All-profiles smoke test** — temporary console script iterates all 114 IDs through the profile renderer; assert no thrown errors and zero unmapped-section warnings (or review the warned list and extend the tab mapping).
3. **Mobile pass** — Chrome DevTools device emulation (iPhone SE + Pixel) plus at least one real phone via `npx wrangler dev` on LAN: bottom sheet drag, pinch zoom, chip rail swipe, welcome overlay.
4. **Visual check against mockup** — side-by-side with `atlas-final-v2.html`.
5. **Deploy preview** — push to a branch, verify on Cloudflare preview URL before merging to `main`.

---

## Open Questions (deferred to implementation)

- Exact 25-topic recolor table (mechanical; chosen during implementation with the contrast rule above).
- Cluster centroid coordinates for the wider canvas (tuned visually).
- Bottom-sheet snap points (peek ~55% / full) may shift after real-device testing.
