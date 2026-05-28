# Design: AI Figures Network — Cloudflare Pages Deployment

**Date:** 2026-05-27
**Status:** Approved

---

## Overview

Deploy the AI Figures Network static site to Cloudflare Pages via a GitHub repository, with a custom domain. The site must render identically to the local HTML file. No build step is required.

---

## Repository Structure

```
ai-figures-network/          ← GitHub repo root
├── index.html               ← renamed from ai-figures-network.html
├── data/
│   ├── research-data.js
│   └── summaries-data.js
└── README.md
```

**Future growth pattern:**
- New HTML pages → repo root
- New data files → `data/`
- Images/icons → `assets/`
- Shared CSS → `css/`

---

## Required Code Change

Two `<script src>` lines in `index.html` must be updated to reflect the new `data/` subfolder:

**Before:**
```html
<script src="research-data.js"></script>
<script src="summaries-data.js"></script>
```

**After:**
```html
<script src="data/research-data.js"></script>
<script src="data/summaries-data.js"></script>
```

No other code changes. External CDN scripts (D3.js v7, marked.js v9) are unchanged.

---

## Deployment Pipeline

### Step 1: Create GitHub Repository
- Create a new repo (public or private) on GitHub
- Suggested name: `ai-figures-network`
- No template, no auto-generated files

### Step 2: Push Files
- Organize files into the structure above on the local machine
- Apply the two `<script src>` edits
- Push to `main` branch

### Step 3: Connect Cloudflare Pages
- Cloudflare Dashboard → Pages → Create a project → Connect to Git
- Authorize GitHub, select the repo
- Build settings:
  - Build command: *(blank)*
  - Build output directory: `/`
  - Root directory: *(blank)*
- Deploy — a `*.pages.dev` URL is assigned immediately

### Step 4: Custom Domain
- Pages project → Custom domains → Set up a custom domain
- Enter the domain name
- DNS records auto-configured (domain already on Cloudflare)
- HTTPS provisioned automatically

### Step 5: Ongoing Deploys
- Every `git push` to `main` triggers an automatic redeploy (~60 seconds)

---

## Constraints & Decisions

| Decision | Rationale |
|---|---|
| Option A (flat root + `data/` subfolder) over `public/` folder | No build step now; `public/` adds complexity that pays off only with a static site generator |
| Rename to `index.html` | Cloudflare Pages serves `index.html` by default at the root URL |
| No build command | Pure static site — D3.js and marked.js load from CDN |
| Root as build output directory | All files served directly from repo root |

---

## Out of Scope

- Build tooling or static site generator setup
- Additional pages beyond the current three files
- CI/CD beyond Cloudflare Pages' built-in auto-deploy on push
