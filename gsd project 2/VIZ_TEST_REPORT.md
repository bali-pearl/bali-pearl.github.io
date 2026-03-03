# Visualization Test Report

**Date:** March 2, 2026  
**Server Status:** ✅ Running on port 8080 (PID: 26634)  
**All Static Checks:** ✅ PASSED (30/30)

---

## Summary

Based on static analysis, the visualization files are properly configured:

### ✅ File Structure
- All required files present and accessible
- CSV data file contains 9,972 rows with all required columns
- All vendor libraries (THREE.js, PapaParse, 3D-force-graph) are present and valid

### ✅ Code Structure
- HTML properly structured with all required DOM elements
- JavaScript modules use proper ES6 import/export syntax
- Script loading order is correct (THREE.js → PapaParse → 3D-force-graph → main.js)
- All dependencies properly referenced

### ✅ Expected Behavior

When you navigate to `http://localhost:8080/viz/`, you should see:

1. **3D Graph (Center Area)**
   - Dark background (#060812)
   - Glowing spherical nodes in various colors
   - Animated connecting lines with directional arrows
   - Particles flowing along edges (if < 40 nodes)
   - Slow auto-rotation after 3.5 seconds
   - Interactive: Click to focus, drag to rotate, scroll to zoom

2. **Left Sidebar ("panel")**
   - **Data Section:** Should show "9,972 rows · X terms · Y enrollments"
   - **Controls:**
     - Term selector (dropdown with all terms)
     - Graph mode toggle (School→School vs School→Dept→School)
     - Min enrollments slider (1-50)
     - Max edges slider (200-6000)
     - Search input
   - **Top Flows:** Bar chart showing top 6 flows
   - **Enrollments Over Time:** Timeline sparkline chart
   - **Readout:** KPI cards showing Nodes, Edges, Enrollments counts

3. **Top-Right Story Cards**
   - 5 insight cards with icons and descriptions:
     - 🔴 MIT: Harvard's "Other Campus"
     - 📚 FAS sends X% of all cross-registrants
     - 🏥 Public Health bridges all schools
     - 🎓 Professional schools: net importers
     - ✏️ GSD → MIT: X% of design students

4. **Tooltips**
   - Appear on node hover showing school/dept name and enrollment count
   - Appear on link hover showing flow details

---

## Manual Testing Instructions

### Step 1: Open the Visualization

Open your browser and navigate to:
```
http://localhost:8080/viz/
```

### Step 2: Open Developer Tools

- **Chrome/Edge:** Press `Cmd+Option+I` (Mac) or `F12` (Windows/Linux)
- **Safari:** Enable Developer menu in Preferences, then `Cmd+Option+I`
- **Firefox:** Press `Cmd+Option+K` (Mac) or `F12` (Windows/Linux)

### Step 3: Check Console Tab

Look for any **RED** error messages. Common errors and what they mean:

| Error Message | Meaning | Solution |
|--------------|---------|----------|
| `THREE is not defined` | THREE.js failed to load | Check Network tab, verify three.min.js loaded |
| `Papa is not defined` | PapaParse failed to load | Check Network tab, verify papaparse.min.js loaded |
| `ForceGraph3D is not defined` | 3D-force-graph failed to load | Check Network tab, verify 3d-force-graph.min.js loaded |
| `Failed to fetch` | CSV file not loading | Check if CSV exists, check for CORS issues |
| `Cannot read property 'x' of undefined` | Data structure issue | Check if CSV parsed correctly |
| WebGL errors | Graphics rendering issue | Update browser/drivers, check GPU support |

### Step 4: Check Network Tab

Refresh the page (`Cmd+R` or `F5`) and verify all files load with status `200`:

- ✅ index.html
- ✅ styles.css
- ✅ vendor/three.min.js
- ✅ vendor/papaparse.min.js
- ✅ vendor/3d-force-graph.min.js
- ✅ main.js
- ✅ data.js (loaded as module)
- ✅ viz.js (loaded as module)
- ✅ harvard_cross_registration_data.csv

Any `404 Not Found` errors indicate missing files.

### Step 5: Visual Verification Checklist

- [ ] **Background:** Dark blue/black gradient with subtle grid
- [ ] **3D Graph:** Visible with colored nodes and connecting lines
- [ ] **Nodes:** Glowing spheres with labels above them
- [ ] **Edges:** Colored lines with arrows showing direction
- [ ] **Animation:** Graph slowly rotating
- [ ] **Sidebar:** Left panel with data showing (not "Loading...")
- [ ] **Story Cards:** 5 cards visible in top-right corner
- [ ] **KPI Numbers:** Shows actual counts (not "—")

### Step 6: Interaction Tests

Try these interactions:

1. **Hover over a node** → Tooltip should appear with school/dept info
2. **Click a node** → Camera should zoom and focus on that node
3. **Drag with mouse** → Graph should rotate
4. **Scroll wheel** → Should zoom in/out
5. **Click "Reset view"** → Camera should return to default position
6. **Adjust sliders** → Graph should rebuild with new filters
7. **Toggle graph mode** → Should switch between School→School and School→Dept→School
8. **Search for a node** (e.g., "MIT") → Should focus that node

---

## Screenshot Instructions

To provide a comprehensive screenshot, capture:

1. **Full browser window** including:
   - Address bar showing `http://localhost:8080/viz/`
   - The visualization area with 3D graph
   - Left sidebar with controls and data
   - Top-right story cards

2. **Developer Tools Console** showing:
   - Any error messages (RED)
   - Any warning messages (YELLOW)
   - Or showing no errors (empty/only info)

**How to capture:**
- Mac: `Cmd+Shift+4` then drag to select area
- Windows: Use Snipping Tool or `Win+Shift+S`
- Or use browser's built-in screenshot: Right-click → "Capture screenshot"

---

## Common Issues & Solutions

### Issue: Blank/Black Screen

**Diagnosis:**
- Open Console tab → Look for errors
- Open Network tab → Check if all files loaded (200 status)

**Solutions:**
- If THREE error: Verify `vendor/three.min.js` exists and loaded
- If CSV error: Verify `harvard_cross_registration_data.csv` exists
- If WebGL error: Update browser, check GPU support

### Issue: "Loading..." Stuck in Sidebar

**Diagnosis:**
- CSV file not loading or parsing failed

**Solutions:**
- Check Network tab for CSV file (should show 200 status)
- Check Console for PapaParse errors
- Verify CSV file is not corrupted (should be ~493KB)

### Issue: Graph Renders But No Nodes Visible

**Diagnosis:**
- Nodes filtered out by settings OR camera position issue

**Solutions:**
- Click "Reset view" button
- Move "Min enrollments per edge" slider to 1
- Move "Max edges" slider to maximum (6000)
- Try switching graph mode

### Issue: No Story Cards Visible

**Diagnosis:**
- Check if sidebar shows data first
- Story cards depend on data being loaded

**Solutions:**
- Wait 3-5 seconds for data to load
- Inspect element: Look for `<div id="storyCards">` in DOM
- Check Console for JavaScript errors in `computeStoryCards()`

---

## Debug Tools

### Automated Check (Already Run)
```bash
python3 check-viz.py
```
Result: ✅ All 30 checks passed

### Manual Server Check
```bash
# Verify server is running
lsof -ti:8080
# Output: 26634 (process ID)

# Check server logs
# If you started the server in a terminal, check that terminal for HTTP requests
```

### Browser Console Debugging

Open Console and run these commands to check state:

```javascript
// Check if libraries loaded
typeof THREE !== 'undefined'        // should be true
typeof Papa !== 'undefined'         // should be true
typeof ForceGraph3D !== 'undefined' // should be true

// Check if data loaded (after page loads)
// (These commands may not work if variables are in module scope)
```

---

## Expected Console Output

### ✅ Normal (No Errors)
- Console should be empty or show only informational messages
- No RED error messages
- Possible library info messages (not errors)

### ❌ With Errors
Example error messages you might see:

```
Uncaught ReferenceError: THREE is not defined
    at viz.js:43
```
↑ Means THREE.js didn't load

```
Failed to fetch http://localhost:8080/viz/harvard_cross_registration_data.csv
```
↑ Means CSV file not found or server issue

```
WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost
```
↑ Means graphics driver issue or GPU problem

---

## Next Steps

1. **Open** `http://localhost:8080/viz/` in your browser
2. **Open** Developer Tools (Cmd+Option+I)
3. **Check** Console tab for any RED errors
4. **Take** a screenshot showing:
   - The full visualization
   - The Console tab
5. **Report** back with:
   - Screenshot
   - Any console errors (copy the exact text)
   - What you see vs. what's expected

---

## Files Created for Testing

1. `test-viz.html` - Automated web-based checker
   - Open: `http://localhost:8080/test-viz.html`
   - Checks file availability and server status

2. `check-viz.py` - Python validation script (already run)
   - Run: `python3 check-viz.py`
   - Result: ✅ All checks passed

3. `TESTING.md` - This comprehensive guide

---

## Technical Details

**Server:** Python HTTP server (port 8080)  
**Process ID:** 26634  
**Working Directory:** `/Users/jch/Desktop/carisha`  
**Files:** All present and valid  
**CSV Data:** 9,972 rows, ~493KB  
**Vendor Libraries:** THREE.js (2MB), PapaParse (19KB), 3D-force-graph (1.2MB)  

**Static Analysis:** ✅ PASSED  
**File Structure:** ✅ VALID  
**Code Structure:** ✅ VALID  
**Dependencies:** ✅ LOADED  
**Configuration:** ✅ CORRECT
