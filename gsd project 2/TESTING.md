# Visualization Testing Guide

## Quick Test (Manual)

1. **Open the visualization:**
   ```
   http://localhost:8080/viz/
   ```

2. **Open Browser Developer Tools:**
   - Chrome/Edge: Press `F12` or `Cmd+Option+I` (Mac)
   - Safari: Enable "Develop" menu in Preferences, then `Cmd+Option+I`
   - Firefox: Press `F12` or `Cmd+Option+K` (Mac)

3. **What to Check:**

   ### ✅ Visual Checks
   - [ ] Does the page load with a dark background?
   - [ ] Is there a 3D graph visible in the center?
   - [ ] Are there glowing colored nodes (spheres)?
   - [ ] Are there connecting lines/arrows between nodes?
   - [ ] Is the left sidebar visible with controls?
   - [ ] Are there story cards in the top-right corner?
   - [ ] Does it say "Loading..." or show actual data?

   ### ✅ Console Checks
   Go to the "Console" tab in DevTools:
   - [ ] Look for any RED error messages
   - [ ] Check if THREE.js loaded (should NOT see "THREE is not defined")
   - [ ] Check if Papa is loaded (should NOT see "Papa is not defined")
   - [ ] Check if ForceGraph3D loaded

   ### ✅ Network Checks
   Go to the "Network" tab in DevTools, then refresh the page:
   - [ ] Does `harvard_cross_registration_data.csv` load? (Status: 200)
   - [ ] Do vendor files load? (three.min.js, papaparse.min.js, 3d-force-graph.min.js)
   - [ ] Do module files load? (main.js, data.js, viz.js)
   - [ ] Are there any 404 (Not Found) errors?

   ### ✅ Functionality Checks
   - [ ] Does the graph rotate slowly (auto-rotate)?
   - [ ] Can you click and drag to rotate the graph?
   - [ ] Can you scroll to zoom?
   - [ ] When hovering over nodes, do tooltips appear?
   - [ ] When clicking a node, does the camera zoom to it?
   - [ ] Does the sidebar show actual numbers (not "—" or "Loading...")?

## Common Issues & Solutions

### Issue 1: Blank page with no graph
**Possible causes:**
- JavaScript error preventing initialization
- THREE.js not loading
- CSV file not found

**Solutions:**
1. Check console for errors
2. Verify CSV path: try both `./harvard_cross_registration_data.csv` and `../harvard_cross_registration_data.csv`
3. Check if vendor files are loading

### Issue 2: "Loading..." stuck in sidebar
**Possible causes:**
- CSV file not loading
- CSV parsing error
- Fetch failed

**Solutions:**
1. Check Network tab for CSV file status
2. Verify CSV file exists at both `viz/harvard_cross_registration_data.csv` and root
3. Check console for Papa.parse errors

### Issue 3: Graph renders but no nodes visible
**Possible causes:**
- All nodes filtered out by minEnroll/maxEdges
- Camera positioned incorrectly
- Shader/WebGL error

**Solutions:**
1. Try adjusting the "Min enrollments per edge" slider to 1
2. Try adjusting the "Max edges" slider to maximum (6000)
3. Click "Reset view" button
4. Check console for WebGL errors

### Issue 4: Console shows "THREE is not defined"
**Possible causes:**
- three.min.js not loading
- Script loading order issue

**Solutions:**
1. Check that vendor scripts load BEFORE main.js
2. Verify the THREE global shim in index.html lines 129-131
3. Check Network tab to ensure three.min.js loaded successfully

### Issue 5: No story cards visible
**Possible causes:**
- Data not processed yet
- CSS positioning issue
- JavaScript error in computeStoryCards()

**Solutions:**
1. Wait a few seconds for data to load
2. Check if sidebar shows data
3. Inspect element to see if `.story-cards` div exists
4. Check console for errors in renderStoryCards()

## Automated Test
Open this file in your browser to run automated checks:
```
http://localhost:8080/test-viz.html
```

## Debug Commands (from this directory)

```bash
# Check if server is running
lsof -ti:8080

# Check CSV file exists
ls -lh viz/harvard_cross_registration_data.csv

# Check vendor files
ls -lh viz/vendor/

# Check main files
ls -lh viz/*.js viz/*.html

# View server logs (if running in terminal)
# The terminal should show HTTP requests
```

## Expected Console Output (Normal)
When working correctly, you might see:
- No errors (or only warnings)
- Network requests showing 200 status for all files
- Possible INFO messages from force-graph library

## Expected Console Output (Errors)
If there are problems, you might see:
- `THREE is not defined` - THREE.js not loaded
- `Papa is not defined` - PapaParse not loaded
- `ForceGraph3D is not defined` - 3d-force-graph not loaded
- `Failed to fetch` - Network/CORS issue
- `Cannot read property 'x' of undefined` - Data structure issue
- WebGL errors - Graphics rendering issue

## Screenshot Checklist

When taking a screenshot, ensure it shows:
1. The full browser window including address bar
2. The 3D graph visualization area
3. The left sidebar with controls and data
4. The top-right story cards
5. Browser DevTools (Console tab) showing any errors
