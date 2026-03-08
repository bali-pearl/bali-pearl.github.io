# /// script
# requires-python = ">=3.11"
# dependencies = ["matplotlib", "numpy", "pillow"]
# ///
"""Save a static preview of the final GIF frame."""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import io

flows = [
    ("MIT", 2584, "#E63946"),
    ("FAS", 1677, "#457B9D"),
    ("HKS", 561, "#2A9D8F"),
    ("HBSM", 312, "#E9C46A"),
    ("HGSE", 153, "#F4A261"),
    ("HLS", 147, "#8338EC"),
    ("HDS", 87, "#06D6A0"),
    ("HSPH", 43, "#118AB2"),
    ("HMS", 27, "#EF476F"),
]

total = sum(e for _, e, _ in flows)
max_enroll = flows[0][1]
BG = "#0a0e1a"
TEXT_COL = "#e0e0e0"
ACCENT = "#c084fc"


def bezier_path(x0, y0, x1, y1, n=80):
    cx = 0.55 * (x0 + x1)
    ts = np.linspace(0, 1, n)
    xs = (1 - ts)**3 * x0 + 3*(1-ts)**2*ts*cx + 3*(1-ts)*ts**2*cx + ts**3*x1
    ys = (1 - ts)**3 * y0 + 3*(1-ts)**2*ts*y0 + 3*(1-ts)*ts**2*y1 + ts**3*y1
    return xs, ys


fig, ax = plt.subplots(figsize=(10, 6), facecolor=BG)
ax.set_facecolor(BG)
ax.set_xlim(-0.15, 1.15)
ax.set_ylim(-0.08, 1.08)
ax.axis("off")

gsd_x, gsd_y = 0.08, 0.5
n = len(flows)

for i, (name, enroll, color) in enumerate(flows):
    dy = 0.92 - i * (0.84 / (n - 1))
    dx = 0.78
    width = 1.0 + 14.0 * (enroll / max_enroll)
    alpha = 0.7 if name == "MIT" else 0.45

    xs, ys = bezier_path(gsd_x + 0.04, gsd_y, dx - 0.02, dy)
    ax.plot(xs, ys, color=color, linewidth=width, alpha=alpha, solid_capstyle="round", zorder=2)

    pct = enroll / total * 100
    ax.text(dx + 0.02, dy, f"{name}", fontsize=11, fontweight="bold",
            color=color, va="center", zorder=5)
    ax.text(dx + 0.02, dy - 0.04, f"{enroll:,} ({pct:.0f}%)",
            fontsize=8, color=TEXT_COL, va="center", alpha=0.7, zorder=5)

circle = plt.Circle((gsd_x, gsd_y), 0.045, color=ACCENT, alpha=0.85, zorder=10)
ax.add_patch(circle)
ax.text(gsd_x, gsd_y, "GSD", fontsize=13, fontweight="bold",
        color="white", ha="center", va="center", zorder=11)
ax.text(0.5, 1.02, "Where Do GSD Students Cross-Register?",
        fontsize=16, fontweight="bold", color=TEXT_COL, ha="center", va="center", zorder=10)
ax.text(0.5, -0.04,
        f"GSD → MIT accounts for {flows[0][1]:,} of {total:,} total enrollments ({flows[0][1]/total*100:.0f}%)",
        fontsize=10, color=ACCENT, ha="center", va="center", zorder=10)

fig.tight_layout(pad=0.5)
fig.savefig("/Users/jch/Research/bali-pearl.github.io/gsd_flow_preview.png",
            dpi=150, bbox_inches="tight", facecolor=BG)
print("Saved preview")
