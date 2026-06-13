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

test("parseSections handles CRLF line endings", () => {
  const s = parseSections("## A\r\nfoo\r\n## B\r\nbar\r\n");
  assert.deepStrictEqual(s.map(x => x.title), ["A", "B"]);
  assert.strictEqual(s[0].body, "foo\n");
});

test("exported TAB_ORDER is frozen and detached from internals", () => {
  assert.ok(Object.isFrozen(TAB_ORDER));
  assert.throws(() => { "use strict"; TAB_ORDER.push("Extra"); }, TypeError);
  // mapping still works after the attempted mutation
  const tabs = mapSectionsToTabs(parseSections("## Values\nv\n"), () => {});
  assert.deepStrictEqual(tabs.map(t => t.tab), ["Overview", "Values"]);
});
