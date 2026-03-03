import { topEntriesFromMap } from "./data.js";

const VERT = `
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const FRAG = `
uniform vec3 uColor;
uniform float uTime;
uniform float uIntensity;
uniform float uAlpha;

varying vec3 vNormal;
varying vec3 vWorldPos;

float fresnel(vec3 n, vec3 v) {
  return pow(1.0 - max(dot(n, v), 0.0), 2.4);
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float f = fresnel(normalize(vNormal), viewDir);
  float pulse = 0.55 + 0.45 * sin(uTime * 1.15);
  vec3 rim = uColor * (0.45 + 0.85 * f) * (0.55 + 0.45 * pulse);
  vec3 core = uColor * 0.35;
  vec3 col = mix(core, rim, f) * uIntensity;
  float a = uAlpha * (0.55 + 0.45 * f);
  gl_FragColor = vec4(col, a);
}
`;

function parseHexColor(hexOrCss) {
  // If THREE.Color exists, we can rely on it, but keep this helper for CSS strings.
  try {
    return new THREE.Color(hexOrCss);
  } catch {
    return new THREE.Color("#ffffff");
  }
}

export function createNodeObject(node, shared) {
  const kind = node.kind;
  const base = parseHexColor(node.color);

  const baseR = kind === "dept" ? 1.8 : 3.0;
  const maxW = node._maxWeight || 1;
  const ratio = Math.max(0, (node.weight || 0) / maxW);
  const radius = baseR + baseR * 2.2 * Math.pow(ratio, 0.38);
  const geo = new THREE.SphereGeometry(radius, 24, 24);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: base },
      uTime: { value: 0.0 },
      uIntensity: { value: kind === "dept" ? 0.85 : 1.1 },
      uAlpha: { value: kind === "dept" ? 0.78 : 0.92 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);

  // faint halo
  const haloGeo = new THREE.SphereGeometry(radius * 1.55, 18, 18);
  const haloMat = new THREE.MeshBasicMaterial({
    color: base,
    transparent: true,
    opacity: kind === "dept" ? 0.10 : 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  mesh.add(halo);

  // label sprite (canvas)
  const label = makeLabelSprite(node.label, kind, node.color, shared);
  label.position.set(0, radius * 1.9, 0);
  mesh.add(label);

  mesh.userData = { nodeId: node.id, kind };
  return mesh;
}

function makeLabelSprite(text, kind, color, shared) {
  const key = `${kind}:${text}:${color}`;
  if (shared.labelCache.has(key)) return shared.labelCache.get(key).clone();

  const padX = 14;
  const padY = 10;
  const fontSize = kind === "dept" ? 26 : 28;
  const font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  ctx.font = `700 ${font}`;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width) + padX * 2;
  const h = Math.ceil(fontSize * 1.6) + padY * 2;
  canvas.width = w * 2;
  canvas.height = h * 2;
  ctx.scale(2, 2);

  // background pill (glassy)
  const r = 14;
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // accent dot
  ctx.beginPath();
  ctx.arc(12, h / 2, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;

  // text
  ctx.font = `700 ${font}`;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 22, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: kind === "dept" ? 0.72 : 0.82,
  });
  const sprite = new THREE.Sprite(mat);
  const scale = kind === "dept" ? 12 : 13.5;
  sprite.scale.set((w / h) * scale, scale, 1);

  shared.labelCache.set(key, sprite.clone());
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function attachGlowAnimation(graph, shared) {
  // Update shader uniform time for all node objects we created.
  graph.onEngineTick(() => {
    shared.time += 0.016;
    for (const obj of shared.nodeObjects.values()) {
      const mat = obj.material;
      if (mat && mat.uniforms && mat.uniforms.uTime) {
        mat.uniforms.uTime.value = shared.time;
      }
    }
  });
}

export function formatTooltip({ type, title, lines }) {
  const safeTitle = String(title == null ? "" : title);
  const safeLines = (lines || []).map((l) => String(l));
  return `
    <div class="tooltip__title">${escapeHtml(safeTitle)}</div>
    <div class="tooltip__sub">${safeLines.map((l) => escapeHtml(l)).join("<br/>")}</div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (ch) {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return ch;
    }
  });
}

export function linkLabel(link, maxDept = 5) {
  if (!link || !link.meta || !link.meta.dept) return null;
  const top = topEntriesFromMap(link.meta.dept, maxDept);
  if (!top.length) return null;
  const parts = top.map(([k, v]) => `${k} (${v})`);
  return parts.join(", ");
}

