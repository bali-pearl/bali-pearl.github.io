/**
 * main.js – Harvard Cross-Registration Network
 * Orchestrates CSV loading, graph construction, 3D rendering, and storytelling UI.
 */

import {
  buildGraph,
  summarizeRows,
  SCHOOL_META,
} from "./data.js";

import {
  createNodeObject,
  attachGlowAnimation,
  formatTooltip,
  linkLabel,
} from "./viz.js";

/* ═══════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════ */

let allRows = [];
let currentGraph = null;
let fg = null;
let focusedNodeId = null;
const shared = { time: 0, nodeObjects: new Map(), labelCache: new Map() };
let storyCardsEnabled = true;

const $ = (sel) => document.querySelector(sel);

/* ═══════════════════════════════════════════════════════════
   Boot
   ═══════════════════════════════════════════════════════════ */

wireUI();
autoLoad();

/* ═══════════════════════════════════════════════════════════
   Auto-load CSV
   ═══════════════════════════════════════════════════════════ */

async function autoLoad() {
  for (const path of [
    "./harvard_cross_registration_data.csv",
    "../harvard_cross_registration_data.csv",
    "../../harvard_cross_registration_data.csv",
  ]) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trim() && text.includes("Origin School")) {
        ingestCSV(text);
        return;
      }
    } catch {
      /* try next path */
    }
  }
  // No CSV found — prompt user
  const meta = $("#dataMeta");
  if (meta) meta.textContent = "No file loaded — drop CSV above or click Load CSV.";
}

/* ═══════════════════════════════════════════════════════════
   CSV → State
   ═══════════════════════════════════════════════════════════ */

function ingestCSV(raw) {
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

  const { data } = Papa.parse(raw, { header: true, skipEmptyLines: true });
  allRows = data;

  const summary = summarizeRows(allRows);

  const sel = $("#termSelect");
  sel.innerHTML = '<option value="__all__">All terms</option>';
  for (const t of summary.terms) {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    sel.appendChild(o);
  }
  sel.disabled = false;

  $("#minEnroll").disabled = false;
  $("#maxEdges").disabled = false;
  $("#searchInput").disabled = false;

  $("#dataMeta").textContent =
    `${allRows.length.toLocaleString()} rows · ${summary.terms.length} terms · ${summary.totalEnrollments.toLocaleString()} enrollments`;

  // Default to school mode for a cleaner initial view
  $(".segmented__btn.is-active")?.classList.remove("is-active");
  ($("#modeSchoolBtn") || $(".segmented__btn")).classList.add("is-active");

  rebuild();
}

/* ═══════════════════════════════════════════════════════════
   Build Graph
   ═══════════════════════════════════════════════════════════ */

let rebuildTimer;
function rebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(doRebuild, 80);
}

function doRebuild() {
  if (!allRows.length) return;

  const opts = {
    term: $("#termSelect").value,
    mode: $(".segmented__btn.is-active")?.dataset.mode || "school",
    minEnroll: +$("#minEnroll").value,
    maxEdges: +$("#maxEdges").value,
  };

  currentGraph = buildGraph(allRows, opts);

  $("#kpiNodes").textContent = currentGraph.nodes.length;
  $("#kpiEdges").textContent = currentGraph.links.length;
  $("#kpiEnroll").textContent =
    currentGraph.meta.totalEnrollments.toLocaleString();

  renderGraph();
  renderInsights();
  renderTimeline();
}

/* ═══════════════════════════════════════════════════════════
   3D Force Graph
   ═══════════════════════════════════════════════════════════ */

let resizeHandler = null;

function renderGraph() {
  const el = $("#graph");

  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }
  if (fg) {
    try {
      fg.pauseAnimation();
    } catch {}
    el.innerHTML = "";
    fg = null;
  }

  shared.nodeObjects.clear();
  shared.labelCache.clear();
  shared.time = 0;
  focusedNodeId = null;

  const { nodes, links } = currentGraph;
  if (!nodes.length) return;

  const maxW = Math.max(...nodes.map((n) => n.weight || 1));
  const maxL = Math.max(...links.map((l) => l.value || 1));
  const isLargeGraph = nodes.length > 40;

  const colorById = new Map(nodes.map((n) => [n.id, n.color]));
  const srcColor = (link) => {
    const id =
      typeof link.source === "object" ? link.source.id : link.source;
    return colorById.get(id) || "#ffffff";
  };

  fg = ForceGraph3D({ controlType: "orbit" })(el)
    .graphData({ nodes, links })
    .backgroundColor("#060812")
    .showNavInfo(false)
    .nodeThreeObject((node) => {
      node._maxWeight = maxW;
      const obj = createNodeObject(node, shared);
      shared.nodeObjects.set(node.id, obj);
      return obj;
    })
    .nodeThreeObjectExtend(false)
    .linkWidth((l) => 0.4 + 5 * Math.sqrt(l.value / maxL))
    .linkColor((l) => srcColor(l))
    .linkOpacity(0.35)
    .linkDirectionalArrowLength(3.5)
    .linkDirectionalArrowRelPos(0.88)
    .linkDirectionalArrowColor((l) => srcColor(l))
    .linkDirectionalParticles(
      isLargeGraph
        ? 0
        : (l) => Math.max(1, Math.ceil(4 * (l.value / maxL)))
    )
    .linkDirectionalParticleWidth(1.5)
    .linkDirectionalParticleSpeed(0.004)
    .linkDirectionalParticleColor((l) => srcColor(l))
    .onNodeHover(onNodeHover)
    .onNodeClick(onNodeClick)
    .onLinkHover(onLinkHover)
    .warmupTicks(50)
    .cooldownTicks(200);

  if (typeof fg.linkCurvature === "function") fg.linkCurvature(0.18);

  try {
    fg.d3Force("charge").strength(isLargeGraph ? -60 : -200);
    fg.d3Force("link").distance((l) => 30 + 90 * (1 - l.value / maxL));
  } catch {}

  attachGlowAnimation(fg, shared);

  setTimeout(() => {
    try {
      const c = fg?.controls();
      if (c) {
        c.autoRotate = true;
        c.autoRotateSpeed = 0.35;
      }
    } catch {}
  }, 3500);

  resizeHandler = () => {
    if (fg) fg.width(el.clientWidth).height(el.clientHeight);
  };
  window.addEventListener("resize", resizeHandler);
}

/* ═══════════════════════════════════════════════════════════
   Interactions
   ═══════════════════════════════════════════════════════════ */

function onNodeHover(node) {
  const tooltip = $("#tooltip");
  $("#graph").style.cursor = node ? "pointer" : "default";

  if (!node) {
    tooltip.hidden = true;
    if (!focusedNodeId) clearHighlight();
    return;
  }

  const code = node.code || node.label;
  const meta = SCHOOL_META[code];
  const kind = node.kind === "school" ? "School" : "Department";
  const lines = [];
  if (meta) lines.push(meta.name);
  lines.push(`${(node.weight || 0).toLocaleString()} enrollments`);

  tooltip.innerHTML = formatTooltip({ type: kind, title: code, lines });
  tooltip.hidden = false;
  highlightNode(node);
}

function onNodeClick(node) {
  if (!node || !fg) return;

  const d = 80;
  fg.cameraPosition(
    { x: node.x + d, y: node.y + d * 0.5, z: node.z + d },
    { x: node.x, y: node.y, z: node.z },
    1200
  );
  try {
    fg.controls().autoRotate = false;
  } catch {}

  focusedNodeId = node.id;
  highlightNode(node);
}

function onLinkHover(link) {
  const tooltip = $("#tooltip");
  if (!link) {
    tooltip.hidden = true;
    return;
  }

  const srcId =
    typeof link.source === "object" ? link.source.id : link.source;
  const tgtId =
    typeof link.target === "object" ? link.target.id : link.target;
  const s = srcId.replace(/^(school|dept):/, "");
  const t = tgtId.replace(/^(school|dept):/, "");

  const lines = [`${link.value.toLocaleString()} enrollments`];
  const depts = linkLabel(link, 5);
  if (depts) lines.push(`Top: ${depts}`);

  tooltip.innerHTML = formatTooltip({
    type: "link",
    title: `${s} → ${t}`,
    lines,
  });
  tooltip.hidden = false;
}

/* ═══════════════════════════════════════════════════════════
   Highlight logic
   ═══════════════════════════════════════════════════════════ */

function highlightNode(node) {
  if (!fg || !currentGraph) return;

  const connected = new Set([node.id]);
  for (const l of currentGraph.links) {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    if (s === node.id) connected.add(t);
    if (t === node.id) connected.add(s);
  }

  for (const [id, obj] of shared.nodeObjects) {
    const hit = connected.has(id);
    if (obj.material?.uniforms?.uAlpha) {
      obj.material.uniforms.uAlpha.value = hit ? 1.0 : 0.1;
    }
    for (const ch of obj.children) {
      if (ch.material) {
        ch.material.opacity = hit
          ? ch.isSprite
            ? 0.92
            : 0.14
          : 0.02;
      }
    }
  }
}

function clearHighlight() {
  if (!currentGraph) return;
  for (const [id, obj] of shared.nodeObjects) {
    const n = currentGraph.nodes.find((x) => x.id === id);
    const dept = n?.kind === "dept";
    if (obj.material?.uniforms?.uAlpha) {
      obj.material.uniforms.uAlpha.value = dept ? 0.78 : 0.92;
    }
    for (const ch of obj.children) {
      if (ch.material) {
        ch.material.opacity = ch.isSprite
          ? dept
            ? 0.72
            : 0.82
          : dept
            ? 0.1
            : 0.14;
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   Insights Panel
   ═══════════════════════════════════════════════════════════ */

function renderInsights() {
  const el = $("#insights");
  if (!el || !currentGraph) return;

  const sorted = [...currentGraph.links].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 6);
  const maxVal = top[0]?.value || 1;

  const flowHtml = top
    .map((l) => {
      const s = (
        typeof l.source === "object" ? l.source.id : l.source
      ).replace(/^(school|dept):/, "");
      const t = (
        typeof l.target === "object" ? l.target.id : l.target
      ).replace(/^(school|dept):/, "");
      const pct = Math.round((l.value / maxVal) * 100);
      const color =
        currentGraph.nodes.find(
          (n) =>
            n.id ===
            (typeof l.source === "object" ? l.source.id : l.source)
        )?.color || "#888";
      return `
      <div class="flow-row">
        <div class="flow-row__label">${s} → ${t}</div>
        <div class="flow-row__bar-bg">
          <div class="flow-row__bar" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="flow-row__val">${l.value.toLocaleString()}</div>
      </div>`;
    })
    .join("");

  el.innerHTML = flowHtml;

  renderStoryCards();
}

/* ═══════════════════════════════════════════════════════════
   Story Cards – key findings
   ═══════════════════════════════════════════════════════════ */

function renderStoryCards() {
  const el = $("#storyCards");
  if (!el) return;

  const cards = computeStoryCards();
  el.innerHTML = cards
    .map(
      (c) => `
    <div class="story-card">
      <div class="story-card__icon">${c.icon}</div>
      <div class="story-card__body">
        <div class="story-card__title">${c.title}</div>
        <div class="story-card__desc">${c.desc}</div>
      </div>
    </div>`
    )
    .join("");

  updateStoryCardsVisibility();
}

function updateStoryCardsVisibility() {
  const el = $("#storyCards");
  if (!el) return;
  const hasCards = el.children.length > 0;
  if (!storyCardsEnabled || !hasCards) {
    el.style.display = "none";
  } else {
    el.style.display = "";
  }
}

function computeStoryCards() {
  if (!allRows.length) return [];

  const cards = [];

  // Total enrollments by origin
  const originTotals = new Map();
  const destTotals = new Map();
  for (const r of allRows) {
    const o = (r["Origin School"] || "").trim();
    const d = (r["Destination School"] || "").trim();
    const e = Number(r.Enrollments) || 0;
    if (o) originTotals.set(o, (originTotals.get(o) || 0) + e);
    if (d) destTotals.set(d, (destTotals.get(d) || 0) + e);
  }

  const totalAll = [...originTotals.values()].reduce((a, b) => a + b, 0);

  // Card 1: MIT is #1 destination
  const mitTotal = destTotals.get("MIT") || 0;
  if (mitTotal > 0) {
    const mitPct = Math.round((mitTotal / totalAll) * 100);
    cards.push({
      icon: "🔴",
      title: `MIT: Harvard's "Other Campus"`,
      desc: `${mitTotal.toLocaleString()} enrollments (${mitPct}%) go to MIT — more than any Harvard school.`,
    });
  }

  // Card 2: FAS dominates outgoing
  const fasOut = originTotals.get("FAS") || 0;
  if (fasOut > 0) {
    const fasPct = Math.round((fasOut / totalAll) * 100);
    cards.push({
      icon: "📚",
      title: `FAS sends ${fasPct}% of all cross-registrants`,
      desc: `${fasOut.toLocaleString()} enrollments from Arts & Sciences — the engine of interdisciplinary flow.`,
    });
  }

  // Card 3: HSPH as health bridge
  const hsphTotal = destTotals.get("HSPH") || 0;
  if (hsphTotal > 0) {
    cards.push({
      icon: "🏥",
      title: "Public Health bridges all schools",
      desc: `HSPH draws ${hsphTotal.toLocaleString()} enrollments from FAS, HMS, & HSDM — health is inherently interdisciplinary.`,
    });
  }

  // Card 4: Professional schools are one-way
  const proSchools = ["HKS", "HGSE", "HBS", "HBSM", "HLS", "HDS"];
  const proTotal = proSchools.reduce(
    (sum, s) => sum + (destTotals.get(s) || 0),
    0
  );
  if (proTotal > 0) {
    cards.push({
      icon: "🎓",
      title: "Professional schools: net importers",
      desc: `${proTotal.toLocaleString()} enrollments flow into HKS, HGSE, HBS, HLS, HDS — but none flow back in this data.`,
    });
  }

  // Card 5: GSD → MIT
  const gsdMit = allRows
    .filter(
      (r) =>
        (r["Origin School"] || "").trim() === "GSD" &&
        (r["Destination School"] || "").trim() === "MIT"
    )
    .reduce((s, r) => s + (Number(r.Enrollments) || 0), 0);
  const gsdTotal = originTotals.get("GSD") || 1;
  if (gsdMit > 0) {
    const gsdMitPct = Math.round((gsdMit / gsdTotal) * 100);
    cards.push({
      icon: "✏️",
      title: `GSD → MIT: ${gsdMitPct}% of design students`,
      desc: `${gsdMit.toLocaleString()} enrollments — GSD students seek MIT's technical depth more than any other destination.`,
    });
  }

  return cards;
}

/* ═══════════════════════════════════════════════════════════
   Timeline sparkline
   ═══════════════════════════════════════════════════════════ */

function renderTimeline() {
  const canvas = $("#timelineCanvas");
  if (!canvas || !allRows.length) return;

  const termMap = new Map();
  for (const r of allRows) {
    const t = (r.Description || "").trim();
    const e = Number(r.Enrollments) || 0;
    if (t) termMap.set(t, (termMap.get(t) || 0) + e);
  }

  const terms = [...termMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  if (!terms.length) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const vals = terms.map((t) => t[1]);
  const maxV = Math.max(...vals);
  const pad = { t: 4, b: 18, l: 6, r: 6 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  ctx.clearRect(0, 0, W, H);

  // Area fill
  ctx.beginPath();
  for (let i = 0; i < vals.length; i++) {
    const x = pad.l + (i / (vals.length - 1)) * plotW;
    const y = pad.t + plotH - (vals[i] / maxV) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(pad.l + plotW, pad.t + plotH);
  ctx.lineTo(pad.l, pad.t + plotH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
  grad.addColorStop(0, "rgba(139, 92, 246, 0.35)");
  grad.addColorStop(1, "rgba(139, 92, 246, 0.02)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  for (let i = 0; i < vals.length; i++) {
    const x = pad.l + (i / (vals.length - 1)) * plotW;
    const y = pad.t + plotH - (vals[i] / maxV) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(139, 92, 246, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Dots
  for (let i = 0; i < vals.length; i++) {
    const x = pad.l + (i / (vals.length - 1)) * plotW;
    const y = pad.t + plotH - (vals[i] / maxV) * plotH;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(139, 92, 246, 0.9)";
    ctx.fill();
  }

  // Term labels (first, last, and lowest)
  ctx.font = "9px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.textAlign = "center";
  const labelIdx = [0, terms.length - 1];
  const minIdx = vals.indexOf(Math.min(...vals));
  if (minIdx !== 0 && minIdx !== terms.length - 1) labelIdx.push(minIdx);
  for (const i of labelIdx) {
    const x = pad.l + (i / (vals.length - 1)) * plotW;
    const short = terms[i][0].replace(/(\d{4})\s/, "$1\n").split("\n")[0];
    ctx.fillText(short, x, H - 3);
  }
}

/* ═══════════════════════════════════════════════════════════
   UI Wiring
   ═══════════════════════════════════════════════════════════ */

function wireUI() {
  // File input
  $("#fileInput")?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) f.text().then(ingestCSV);
  });

  // Drag & drop
  const dz = $("#dropzone");
  if (dz) {
    dz.addEventListener("dragover", (e) => {
      e.preventDefault();
      dz.classList.add("is-dragover");
    });
    dz.addEventListener("dragleave", () => dz.classList.remove("is-dragover"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("is-dragover");
      e.dataTransfer?.files?.[0]?.text().then(ingestCSV);
    });
    dz.addEventListener("click", () => $("#fileInput")?.click());
  }

  // Term selector
  $("#termSelect")?.addEventListener("change", rebuild);

  // Mode toggle
  for (const btn of document.querySelectorAll(".segmented__btn")) {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".segmented__btn")
        .forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      rebuild();
    });
  }

  // Range sliders
  const minE = $("#minEnroll");
  const maxE = $("#maxEdges");
  minE?.addEventListener("input", () => {
    $("#minEnrollValue").textContent = minE.value;
    rebuild();
  });
  maxE?.addEventListener("input", () => {
    $("#maxEdgesValue").textContent = maxE.value;
    rebuild();
  });

  // Search
  let searchTimer;
  $("#searchInput")?.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => applySearch(e.target.value), 300);
  });

  // Story insights toggle
  const storyToggle = $("#storyToggle");
  if (storyToggle) {
    storyToggle.checked = storyCardsEnabled;
    storyToggle.addEventListener("change", (event) => {
      storyCardsEnabled = !!event.target.checked;
      updateStoryCardsVisibility();
    });
  }

  // Reset
  $("#resetBtn")?.addEventListener("click", resetView);
}

function applySearch(q) {
  q = q.trim().toUpperCase();
  if (!q || !currentGraph || !fg) {
    clearHighlight();
    return;
  }
  const match = currentGraph.nodes.find(
    (n) =>
      n.code?.toUpperCase().includes(q) ||
      n.label?.toUpperCase().includes(q)
  );
  if (match) onNodeClick(match);
}

function resetView() {
  if (fg) {
    fg.cameraPosition({ x: 0, y: 0, z: 250 }, { x: 0, y: 0, z: 0 }, 1200);
    try {
      fg.controls().autoRotate = true;
    } catch {}
  }
  focusedNodeId = null;
  clearHighlight();
  if ($("#searchInput")) $("#searchInput").value = "";
  $("#tooltip").hidden = true;
}
