#!/usr/bin/env python3
"""
Static analysis tool to check for common JavaScript issues
in the visualization files
"""

import os
import re
from pathlib import Path

VIZ_DIR = Path(__file__).parent / 'viz'

print('🔍 Checking visualization files for common issues...\n')

checks = {
    'passed': 0,
    'failed': 0,
    'warnings': 0
}

def pass_check(msg):
    print(f'✅ {msg}')
    checks['passed'] += 1

def fail_check(msg):
    print(f'❌ {msg}')
    checks['failed'] += 1

def warn_check(msg):
    print(f'⚠️  {msg}')
    checks['warnings'] += 1

# Check 1: Required files exist
print('📁 Checking file structure...')
required_files = [
    'index.html',
    'main.js',
    'data.js',
    'viz.js',
    'styles.css',
    'harvard_cross_registration_data.csv',
    'vendor/three.min.js',
    'vendor/papaparse.min.js',
    'vendor/3d-force-graph.min.js'
]

for file in required_files:
    file_path = VIZ_DIR / file
    if file_path.exists():
        pass_check(f'Found: {file}')
    else:
        fail_check(f'Missing: {file}')

print('\n📝 Checking HTML structure...')
# Check 2: index.html structure
index_path = VIZ_DIR / 'index.html'
if index_path.exists():
    html = index_path.read_text()
    
    # Check script loading order
    script_pattern = r'<script[^>]*src=["\'](.*?)["\']'
    script_srcs = re.findall(script_pattern, html)
    
    print('Script loading order:')
    for i, src in enumerate(script_srcs, 1):
        print(f'  {i}. {src}')
    
    # Verify THREE loads before main.js
    three_idx = next((i for i, s in enumerate(script_srcs) if 'three' in s.lower()), -1)
    main_idx = next((i for i, s in enumerate(script_srcs) if 'main.js' in s), -1)
    
    if three_idx != -1 and main_idx != -1 and three_idx < main_idx:
        pass_check('THREE.js loads before main.js')
    elif three_idx == -1:
        fail_check('THREE.js script tag not found')
    elif main_idx == -1:
        fail_check('main.js script tag not found')
    else:
        fail_check('THREE.js must load before main.js')
    
    # Check for required DOM elements
    required_ids = [
        'graph', 'panel', 'storyCards', 'tooltip', 
        'termSelect', 'minEnroll', 'maxEdges', 'searchInput'
    ]
    
    for elem_id in required_ids:
        if f'id="{elem_id}"' in html:
            pass_check(f'Found element: #{elem_id}')
        else:
            fail_check(f'Missing element: #{elem_id}')

print('\n🔧 Checking JavaScript modules...')
# Check 3: JavaScript syntax and exports
js_files = ['data.js', 'viz.js', 'main.js']

for file in js_files:
    js_path = VIZ_DIR / file
    if js_path.exists():
        content = js_path.read_text()
        
        # Check for exports in data.js and viz.js
        if file != 'main.js':
            if 'export ' in content:
                pass_check(f'{file}: Contains exports')
            else:
                fail_check(f'{file}: No exports found (should use ES6 modules)')
        
        # Check for imports in main.js
        if file == 'main.js':
            if 'import ' in content:
                pass_check(f'{file}: Contains imports')
            else:
                fail_check(f'{file}: No imports found')
        
        # Check for console.log (should be removed for production)
        console_count = len(re.findall(r'console\.(log|warn|error)', content))
        if console_count > 0:
            warn_check(f'{file}: Found {console_count} console statements (consider removing)')
        
        # Check for library usage
        if 'ForceGraph3D' in content:
            pass_check(f'{file}: Uses ForceGraph3D global')
        
        if 'Papa.parse' in content:
            pass_check(f'{file}: Uses Papa.parse for CSV')
        
        if 'THREE.' in content:
            pass_check(f'{file}: Uses THREE.js')

print('\n📊 Checking CSV data...')
# Check 4: CSV file
csv_path = VIZ_DIR / 'harvard_cross_registration_data.csv'
if csv_path.exists():
    csv_content = csv_path.read_text()
    lines = [l for l in csv_content.split('\n') if l.strip()]
    header = lines[0] if lines else ''
    
    pass_check(f'CSV has {len(lines)} lines')
    
    # Check for required columns
    required_cols = ['Description', 'Origin School', 'Destination School', 'Enrollments']
    missing_cols = [col for col in required_cols if col not in header]
    
    if not missing_cols:
        pass_check('CSV has all required columns')
    else:
        fail_check(f'CSV missing columns: {", ".join(missing_cols)}')
    
    # Sample a few data rows
    if len(lines) > 1:
        sample_row = lines[1]
        if len(sample_row.split(',')) >= 4:
            pass_check('CSV data format looks valid')
        else:
            warn_check('CSV data format may be incorrect')

print('\n📦 Checking vendor libraries...')
# Check 5: Vendor file sizes (to ensure they're not empty/corrupted)
vendor_files = [
    {'name': 'three.min.js', 'min_size': 500000},
    {'name': 'papaparse.min.js', 'min_size': 10000},
    {'name': '3d-force-graph.min.js', 'min_size': 100000}
]

for vendor in vendor_files:
    vendor_path = VIZ_DIR / 'vendor' / vendor['name']
    if vendor_path.exists():
        size = vendor_path.stat().st_size
        if size >= vendor['min_size']:
            pass_check(f'{vendor["name"]}: {size // 1024}KB (looks good)')
        else:
            warn_check(f'{vendor["name"]}: Only {size // 1024}KB (may be corrupted)')

# Summary
print('\n' + '=' * 50)
print('📊 Summary:')
print(f'   ✅ Passed: {checks["passed"]}')
print(f'   ⚠️  Warnings: {checks["warnings"]}')
print(f'   ❌ Failed: {checks["failed"]}')
print('=' * 50)

if checks['failed'] > 0:
    print('\n⚠️  Some checks failed. Please review the issues above.')
    exit(1)
elif checks['warnings'] > 0:
    print('\n✅ All critical checks passed, but there are some warnings.')
    exit(0)
else:
    print('\n✅ All checks passed! The visualization should work correctly.')
    exit(0)
