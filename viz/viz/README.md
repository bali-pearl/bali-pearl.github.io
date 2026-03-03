# Harvard Cross-Registration Network (self-hosted)

Interactive 3D visualization of cross-registration flows between Harvard schools and partner institutions (2020–2025). Zero-build (no `npm`), WebGL-based.

## Run locally

```bash
cd /path/to/carisha
python3 -m http.server 8080
```

Then open `http://localhost:8080/viz/`.

## Data

The page auto-loads `harvard_cross_registration_data.csv` from the `viz/` folder (or parent folder). You can also drag-drop or use **Load CSV**.

Nothing uploads anywhere — parsing and graph construction happen locally in your browser.

## What you see

- **School → School** mode (default): direct flows between schools, sized by total enrollment. Hover links for department breakdown.
- **School → Dept → School** mode: origin school → department nodes (parsed from `Course #`) → destination school.
- **Story cards** (top-right): auto-generated key findings from the data.
- **Top Flows** (sidebar): ranked flow list with proportional bars.
- **Timeline** (sidebar): enrollment sparkline across terms.
- **Term filter**: isolate individual semesters.

## Vendor libraries

All dependencies are vendored locally (no CDN/internet needed):
- Three.js r183
- 3d-force-graph v1.79.1
- PapaParse v5.4.1
