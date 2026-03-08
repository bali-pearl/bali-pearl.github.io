export const SCHOOL_META = {
  FAS:      { name: "Faculty of Arts & Sciences",            short: "FAS",      category: "origin" },
  GSD:      { name: "Graduate School of Design",             short: "GSD",      category: "origin" },
  HMS:      { name: "Harvard Medical School",                short: "HMS",      category: "origin" },
  HSDM:     { name: "School of Dental Medicine",             short: "HSDM",     category: "origin" },
  MIT:      { name: "Massachusetts Institute of Technology",  short: "MIT",      category: "external" },
  HSPH:     { name: "T.H. Chan School of Public Health",     short: "HSPH",     category: "professional" },
  HGSE:     { name: "Graduate School of Education",          short: "HGSE",     category: "professional" },
  HKS:      { name: "Harvard Kennedy School",                short: "HKS",      category: "professional" },
  HBS:      { name: "Harvard Business School",               short: "HBS",      category: "professional" },
  HBSM:     { name: "Harvard Business School (MBA)",         short: "HBSM",     category: "professional" },
  HLS:      { name: "Harvard Law School",                    short: "HLS",      category: "professional" },
  HDS:      { name: "Harvard Divinity School",               short: "HDS",      category: "professional" },
  BROWN:    { name: "Brown University",                      short: "Brown",    category: "external" },
  FLETCHER: { name: "Fletcher School (Tufts)",               short: "Fletcher", category: "external" },
  HBSD:     { name: "Harvard Business School (Doctoral)",    short: "HBSD",     category: "professional" },
};

const DEPT_REGEX = /^([A-Z][A-Z0-9&-]*[A-Z0-9]?)(?=\s*\d|$)/;
const DEPT_FALLBACK_REGEX = /\b([A-Z]{2,}(?:-[A-Z]{2,})?)\b/;

export function extractDept(courseNumberOrTitle) {
  const raw = (courseNumberOrTitle == null ? "" : String(courseNumberOrTitle)).trim();
  if (!raw) return "UNKNOWN";

  // Primary: course number format (e.g., "ENG-SCI  143", "COMPSCI   50", "ENGLISHCBBR")
  const m = raw.match(DEPT_REGEX);
  if (m && m[1]) return m[1];

  // Fallback: try to find a department-like token embedded in strings.
  const f = raw.match(DEPT_FALLBACK_REGEX);
  if (f && f[1]) return f[1];

  const first = raw.split(/\s+/)[0];
  return first || "UNKNOWN";
}

function normTerm(term) {
  return (term == null ? "" : String(term)).trim();
}

function safeNum(n) {
  const v = Number(n);
  return isFinite(v) ? v : 0;
}

function key(a, b) {
  return `${a}→${b}`;
}

function stableHash(str) {
  // small, deterministic hash for colors (not crypto)
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

const SCHOOL_COLORS = {
  GSAS:     "#A9C8CA", // teal – grad arts & sciences
  FAS:      "#D6D7CA", // sage – faculty of arts & sciences / DCE
  HSDM:     "#C5D29C", // sage green – dental medicine
  HSPH:     "#E9AB68", // amber – public health
  HMS:      "#ED6B46", // terracotta – medical school
  SEAS:     "#B6C8AF", // muted green – engineering & applied sciences
  GSD:      "#C0C8E0", // periwinkle – design
  HGSE:     "#869BB2", // steel blue – education
  HKS:      "#ECAD9E", // blush – Kennedy school
  HLS:      "#424548", // charcoal – law
  HDS:      "#88605E", // mauve – divinity
  HBS:      "#503936", // dark brown – business
  HBSM:     "#503936", // dark brown – business MBA
  HBSD:     "#503936", // dark brown – business doctoral
  MIT:      "#fb7185", // rose – external standout
  BROWN:    "#c2410c", // brown – Brown University
  FLETCHER: "#0ea5e9", // sky – Fletcher/Tufts
};

export function colorForSchool(code) {
  return SCHOOL_COLORS[code] || "#888888";
}

export function colorForDept(dept) {
  // pleasing spread: map hash to HSL
  const h = stableHash(dept == null ? "" : String(dept)) % 360;
  const s = 72;
  const l = 56;
  return `hsl(${h} ${s}% ${l}%)`;
}

export function summarizeRows(rows) {
  let total = 0;
  const terms = new Map();
  for (const r of rows) {
    const t = normTerm(r.Description);
    if (t) {
      const existing = terms.get(t);
      terms.set(t, (existing == null ? 0 : existing) + 1);
    }
    total += safeNum(r.Enrollments);
  }
  const termList = Array.from(terms.keys()).sort();
  return { totalEnrollments: total, terms: termList };
}

export function buildGraph(rows, opts) {
  opts = opts || {};
  const term = opts.term != null ? opts.term : "__all__";
  const mode = opts.mode != null ? opts.mode : "dept"; // 'dept' or 'school'
  const minEnroll = opts.minEnroll != null ? opts.minEnroll : 1;
  const maxEdges = opts.maxEdges != null ? opts.maxEdges : 2000;

  const termNorm = term === "__all__" ? "__all__" : normTerm(term);

  const filtered = [];
  let totalEnroll = 0;

  for (const r of rows) {
    const t = normTerm(r.Description);
    if (termNorm !== "__all__" && t !== termNorm) continue;

    const origin = (r["Origin School"] == null ? "" : String(r["Origin School"])).trim();
    const dest = (r["Destination School"] == null ? "" : String(r["Destination School"])).trim();
    if (!origin || !dest) continue;

    const enroll = safeNum(r.Enrollments);
    if (enroll <= 0) continue;

    const courseNum = r["Course #"];
    const title = (r.Title == null ? "" : String(r.Title)).trim();
    const dept = extractDept(courseNum || title);

    filtered.push({
      term: t,
      origin,
      dest,
      dept,
      title,
      enroll,
    });
    totalEnroll += enroll;
  }

  const nodes = new Map(); // id -> node
  const edges = new Map(); // key -> {source, target, value, meta}

  function ensureNode(id, node) {
    if (!nodes.has(id)) nodes.set(id, node);
  }

  function addEdge(source, target, value, meta) {
    const k = key(source, target);
    const existing = edges.get(k);
    if (!existing) {
      // normalise meta so that meta.dept is always a Map when provided
      if (meta && meta.dept) {
        const m = new Map();
        m.set(meta.dept, value);
        edges.set(k, { source, target, value, meta: { dept: m } });
      } else {
        edges.set(k, { source, target, value, meta: {} });
      }
    } else {
      existing.value += value;
      if (meta && meta.dept) {
        let deptMap = existing.meta.dept;
        if (!deptMap || typeof deptMap.set !== "function") {
          deptMap = existing.meta.dept = new Map();
        }
        const current = deptMap.get(meta.dept);
        deptMap.set(meta.dept, (current == null ? 0 : current) + value);
      }
    }
  }

  if (mode === "dept") {
    for (const r of filtered) {
      const sO = `school:${r.origin}`;
      const sD = `school:${r.dest}`;
      const dX = `dept:${r.dept}`;

      ensureNode(sO, {
        id: sO,
        kind: "school",
        code: r.origin,
        label: r.origin,
        color: colorForSchool(r.origin),
      });
      ensureNode(sD, {
        id: sD,
        kind: "school",
        code: r.dest,
        label: r.dest,
        color: colorForSchool(r.dest),
      });
      ensureNode(dX, {
        id: dX,
        kind: "dept",
        code: r.dept,
        label: r.dept,
        color: colorForDept(r.dept),
      });

      addEdge(sO, dX, r.enroll, { dept: r.dept });
      addEdge(dX, sD, r.enroll, { dept: r.dept });
    }
  } else {
    // school → school aggregation; keep dept distribution for hover
    for (const r of filtered) {
      const sO = `school:${r.origin}`;
      const sD = `school:${r.dest}`;

      ensureNode(sO, {
        id: sO,
        kind: "school",
        code: r.origin,
        label: r.origin,
        color: colorForSchool(r.origin),
      });
      ensureNode(sD, {
        id: sD,
        kind: "school",
        code: r.dest,
        label: r.dest,
        color: colorForSchool(r.dest),
      });

      // store dept distribution in meta.dept as Map
      const k = key(sO, sD);
      const existing = edges.get(k);
      if (!existing) {
        const m = { dept: new Map([[r.dept, r.enroll]]) };
        edges.set(k, { source: sO, target: sD, value: r.enroll, meta: m });
      } else {
        existing.value += r.enroll;
        const cur = existing.meta.dept.get(r.dept);
        existing.meta.dept.set(r.dept, (cur == null ? 0 : cur) + r.enroll);
      }
    }
  }

  // Convert to arrays, filter by minEnroll, then keep top maxEdges by weight.
  let links = Array.from(edges.values()).filter((e) => e.value >= minEnroll);
  links.sort((a, b) => b.value - a.value);
  links = links.slice(0, Math.max(50, maxEdges));

  const used = new Set();
  for (const l of links) {
    used.add(l.source);
    used.add(l.target);
  }

  const nodeArr = Array.from(nodes.values()).filter((n) => used.has(n.id));

  // Degree/weight for sizing
  const weight = new Map();
  for (const l of links) {
    const curS = weight.get(l.source);
    weight.set(l.source, (curS == null ? 0 : curS) + l.value);
    const curT = weight.get(l.target);
    weight.set(l.target, (curT == null ? 0 : curT) + l.value);
  }
  for (const n of nodeArr) {
    const w = weight.get(n.id);
    n.weight = w == null ? 0 : w;
  }

  return {
    nodes: nodeArr,
    links,
    meta: {
      totalEnrollments: totalEnroll,
      rowCount: filtered.length,
      term: termNorm,
      mode,
    },
  };
}

export function topEntriesFromMap(mapLike, n) {
  if (!mapLike) return [];
  const arr = Array.from(mapLike.entries());
  arr.sort((a, b) => b[1] - a[1]);
  return arr.slice(0, n);
}

