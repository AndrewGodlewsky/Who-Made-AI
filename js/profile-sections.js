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
    for (const line of String(mdText).split(/\r?\n/)) {
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

  const api = {
    TAB_ORDER: Object.freeze(TAB_ORDER.slice()),
    parseSections,
    mapSectionsToTabs,
    normalizeTitle,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.ProfileSections = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
