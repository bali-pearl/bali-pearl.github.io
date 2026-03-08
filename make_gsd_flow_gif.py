# /// script
# requires-python = ">=3.11"
# dependencies = ["matplotlib", "numpy", "pillow"]
# ///
"""Animated GIF: GSD cross-registration flows — MIT dominates."""

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch
from matplotlib.path import Path as MPath
import matplotlib.patches as mpatches
from PIL import Image
import io

# ── Data ──────────────────────────────────────────────────
flows = [
    ("MIT", 2584, "#E63946"),      # red — dominant
    ("FAS", 1677, "#457B9D"),      # blue
    ("HKS", 561, "#2A9D8F"),       # teal
    ("HBSM", 312, "#E9C46A"),     # gold
    ("HGSE", 153, "#F4A261"),     # orange
    ("HLS", 147, "#8338EC"),      # purple
    ("HDS", 87, "#06D6A0"),       # green
    ("HSPH", 43, "#118AB2"),      # cerulean
    ("HMS", 27, "#EF476F"),       # pink
]

SCHOOL_NAMES = {
    "MIT": "MIT",
    "FAS": "Arts & Sciences",
    "HKS": "Kennedy School",
    "HBSM": "Business (online)",
    "HGSE": "Education",
    "HLS": "Law School",
    "HDS": "Divinity School",
    "HSPH": "Public Health",
    "HMS": "Medical School",
}

total = sum(e for _, e, _ in flows)
max_enroll = flows[0][1]

BG = "#0a0e1a"
TEXT_COL = "#e0e0e0"
ACCENT = "#c084fc"  # purple accent for GSD


def bezier_path(x0, y0, x1, y1, n=80):
    """Cubic bezier from (x0,y0) to (x1,y1) with horizontal control points."""
    cx = 0.55 * (x0 + x1)
    ts = np.linspace(0, 1, n)
    xs = (1 - ts) ** 3 * x0 + 3 * (1 - ts) ** 2 * ts * cx + 3 * (1 - ts) * ts**2 * cx + ts**3 * x1
    ys = (1 - ts) ** 3 * y0 + 3 * (1 - ts) ** 2 * ts * y0 + 3 * (1 - ts) * ts**2 * y1 + ts**3 * y1
    return xs, ys


def draw_frame(progress, phase):
    """
    progress: 0→1 within each phase
    phase: 0 = build flows one-by-one, 1 = hold with labels
    """
    fig, ax = plt.subplots(figsize=(10, 6), facecolor=BG)
    ax.set_facecolor(BG)
    ax.set_xlim(-0.15, 1.15)
    ax.set_ylim(-0.08, 1.08)
    ax.axis("off")

    # Positions
    gsd_x, gsd_y = 0.08, 0.5
    n = len(flows)
    dest_positions = {}
    for i, (name, _, _) in enumerate(flows):
        dy = 0.92 - i * (0.84 / (n - 1))
        dest_positions[name] = (0.78, dy)

    # How many flows to show
    if phase == 0:
        # Reveal flows one by one
        n_full = int(progress * n)
        partial_frac = (progress * n) - n_full
    else:
        n_full = n
        partial_frac = 0

    # Draw flows
    for i, (name, enroll, color) in enumerate(flows):
        dx, dy = dest_positions[name]
        width = 1.0 + 14.0 * (enroll / max_enroll)
        alpha = 0.7 if name == "MIT" else 0.45

        if i < n_full:
            frac = 1.0
        elif i == n_full and phase == 0:
            frac = partial_frac
        else:
            continue

        xs, ys = bezier_path(gsd_x + 0.04, gsd_y, dx - 0.02, dy)
        pts = int(frac * len(xs))
        if pts < 2:
            continue

        ax.plot(xs[:pts], ys[:pts], color=color, linewidth=width,
                alpha=alpha, solid_capstyle="round", zorder=2)

        # Destination label
        if frac > 0.9:
            label_alpha = min(1.0, (frac - 0.9) / 0.1)
            pct = enroll / total * 100
            ax.text(dx + 0.02, dy, f"{name}", fontsize=11, fontweight="bold",
                    color=color, va="center", alpha=label_alpha, zorder=5)
            ax.text(dx + 0.02, dy - 0.04,
                    f"{enroll:,} ({pct:.0f}%)",
                    fontsize=8, color=TEXT_COL, va="center", alpha=label_alpha * 0.7, zorder=5)

    # GSD node
    circle = plt.Circle((gsd_x, gsd_y), 0.045, color=ACCENT, alpha=0.85, zorder=10)
    ax.add_patch(circle)
    ax.text(gsd_x, gsd_y, "GSD", fontsize=13, fontweight="bold",
            color="white", ha="center", va="center", zorder=11)

    # Title
    if phase == 0 and progress < 0.15:
        title_alpha = progress / 0.15
    else:
        title_alpha = 1.0
    ax.text(0.5, 1.02, "Where Do GSD Students Cross-Register?",
            fontsize=16, fontweight="bold", color=TEXT_COL,
            ha="center", va="center", alpha=title_alpha, zorder=10)

    # Subtitle appears in hold phase
    if phase == 1:
        sub_alpha = min(1.0, progress / 0.3)
        ax.text(0.5, -0.04,
                f"GSD → MIT accounts for {flows[0][1]:,} of {total:,} total enrollments ({flows[0][1]/total*100:.0f}%)",
                fontsize=10, color=ACCENT, ha="center", va="center",
                alpha=sub_alpha, zorder=10)

    fig.tight_layout(pad=0.5)
    return fig


def fig_to_image(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return Image.open(buf).convert("RGBA")


def main():
    frames = []

    # Phase 0: build flows (40 frames, ~2.7s at 15fps)
    for i in range(40):
        p = i / 39
        fig = draw_frame(p, phase=0)
        frames.append(fig_to_image(fig))

    # Phase 1: hold with subtitle (25 frames, ~1.7s)
    for i in range(25):
        p = i / 24
        fig = draw_frame(p, phase=1)
        frames.append(fig_to_image(fig))

    # Extra hold frames at end (15 frames, ~1s)
    final = frames[-1]
    for _ in range(15):
        frames.append(final.copy())

    out = "/Users/jch/Research/bali-pearl.github.io/gsd_to_mit_flows.gif"
    frames[0].save(
        out,
        save_all=True,
        append_images=frames[1:],
        duration=67,  # ~15fps
        loop=0,
        optimize=True,
    )
    print(f"Saved {out} ({len(frames)} frames)")


if __name__ == "__main__":
    main()
