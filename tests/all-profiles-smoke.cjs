// tests/all-profiles-smoke.cjs
// Loads the REAL data files and verifies every person's research profile
// parses into tabs with no unmapped sections. Exits 1 on any failure.
// Run: node tests/all-profiles-smoke.cjs
const fs = require("node:fs");
const path = require("node:path");
const { parseSections, mapSectionsToTabs } = require("../js/profile-sections.js");

function loadGlobal(file, name) {
  let src = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  // Strip UTF-8 BOM if present (e.g., in research-data.js)
  src = src.replace(/^﻿/, "");
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
  let failed = false;
  if (unmapped.length) { console.error(`FAIL ${p.id}: unmapped sections: ${unmapped.join(" | ")}`); failed = true; }
  if (tabs.length < 2) { console.error(`FAIL ${p.id}: only ${tabs.length} tab(s)`); failed = true; }
  if (failed) failures++;
}
console.log(`Checked ${PEOPLE.length} profiles — ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
