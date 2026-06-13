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

// ─── TEMPORARY STUBS — replaced wholesale in Task 7 ───
function openProfileFor(d) {}
function closeProfile() {}
function refreshDrawerList() {}
function closeDrawer() {}
function hideWelcome(forever) {}
