#!/usr/bin/env node

/**
 * Static analysis tool to check for common JavaScript issues
 * in the visualization files
 */

const fs = require('fs');
const path = require('path');

const VIZ_DIR = path.join(__dirname, 'viz');

console.log('🔍 Checking visualization files for common issues...\n');

const checks = {
    passed: 0,
    failed: 0,
    warnings: 0
};

function pass(msg) {
    console.log(`✅ ${msg}`);
    checks.passed++;
}

function fail(msg) {
    console.log(`❌ ${msg}`);
    checks.failed++;
}

function warn(msg) {
    console.log(`⚠️  ${msg}`);
    checks.warnings++;
}

// Check 1: Required files exist
console.log('📁 Checking file structure...');
const requiredFiles = [
    'index.html',
    'main.js',
    'data.js',
    'viz.js',
    'styles.css',
    'harvard_cross_registration_data.csv',
    'vendor/three.min.js',
    'vendor/papaparse.min.js',
    'vendor/3d-force-graph.min.js'
];

for (const file of requiredFiles) {
    const filePath = path.join(VIZ_DIR, file);
    if (fs.existsSync(filePath)) {
        pass(`Found: ${file}`);
    } else {
        fail(`Missing: ${file}`);
    }
}

console.log('\n📝 Checking HTML structure...');
// Check 2: index.html structure
const indexPath = path.join(VIZ_DIR, 'index.html');
if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8');
    
    // Check script loading order
    const scriptTags = html.match(/<script[^>]*>[\s\S]*?<\/script>|<script[^>]*\/>/gi) || [];
    const scriptSrcs = scriptTags
        .map(tag => {
            const match = tag.match(/src=["']([^"']+)["']/);
            return match ? match[1] : null;
        })
        .filter(Boolean);
    
    console.log('Script loading order:');
    scriptSrcs.forEach((src, i) => console.log(`  ${i + 1}. ${src}`));
    
    // Verify THREE loads before main.js
    const threeIdx = scriptSrcs.findIndex(s => s.includes('three'));
    const mainIdx = scriptSrcs.findIndex(s => s.includes('main.js'));
    
    if (threeIdx !== -1 && mainIdx !== -1 && threeIdx < mainIdx) {
        pass('THREE.js loads before main.js');
    } else if (threeIdx === -1) {
        fail('THREE.js script tag not found');
    } else if (mainIdx === -1) {
        fail('main.js script tag not found');
    } else {
        fail('THREE.js must load before main.js');
    }
    
    // Check for required DOM elements
    const requiredIds = [
        'graph', 'panel', 'storyCards', 'tooltip', 
        'termSelect', 'minEnroll', 'maxEdges', 'searchInput'
    ];
    
    for (const id of requiredIds) {
        if (html.includes(`id="${id}"`)) {
            pass(`Found element: #${id}`);
        } else {
            fail(`Missing element: #${id}`);
        }
    }
}

console.log('\n🔧 Checking JavaScript modules...');
// Check 3: JavaScript syntax and exports
const jsFiles = ['data.js', 'viz.js', 'main.js'];

for (const file of jsFiles) {
    const jsPath = path.join(VIZ_DIR, file);
    if (fs.existsSync(jsPath)) {
        const content = fs.readFileSync(jsPath, 'utf8');
        
        // Check for exports in data.js and viz.js
        if (file !== 'main.js') {
            if (content.includes('export ')) {
                pass(`${file}: Contains exports`);
            } else {
                fail(`${file}: No exports found (should use ES6 modules)`);
            }
        }
        
        // Check for imports in main.js
        if (file === 'main.js') {
            if (content.includes('import ')) {
                pass(`${file}: Contains imports`);
            } else {
                fail(`${file}: No imports found`);
            }
        }
        
        // Check for common syntax issues
        const issues = [];
        
        // Check for console.log (should be removed for production)
        const consoleCount = (content.match(/console\.(log|warn|error)/g) || []).length;
        if (consoleCount > 0) {
            warn(`${file}: Found ${consoleCount} console statements (consider removing)`);
        }
        
        // Check for undefined globals
        if (content.includes('ForceGraph3D') && !content.includes('import')) {
            // main.js uses ForceGraph3D but doesn't import it (it's global)
            pass(`${file}: Uses ForceGraph3D global`);
        }
        
        if (content.includes('Papa.parse')) {
            pass(`${file}: Uses Papa.parse for CSV`);
        }
        
        if (content.includes('THREE.')) {
            pass(`${file}: Uses THREE.js`);
        }
    }
}

console.log('\n📊 Checking CSV data...');
// Check 4: CSV file
const csvPath = path.join(VIZ_DIR, 'harvard_cross_registration_data.csv');
if (fs.existsSync(csvPath)) {
    const csv = fs.readFileSync(csvPath, 'utf8');
    const lines = csv.split('\n').filter(l => l.trim());
    const header = lines[0];
    
    pass(`CSV has ${lines.length} lines`);
    
    // Check for required columns
    const requiredCols = ['Description', 'Origin School', 'Destination School', 'Enrollments'];
    const missingCols = requiredCols.filter(col => !header.includes(col));
    
    if (missingCols.length === 0) {
        pass('CSV has all required columns');
    } else {
        fail(`CSV missing columns: ${missingCols.join(', ')}`);
    }
    
    // Sample a few data rows
    if (lines.length > 1) {
        const sampleRow = lines[1];
        if (sampleRow.split(',').length >= 4) {
            pass('CSV data format looks valid');
        } else {
            warn('CSV data format may be incorrect');
        }
    }
}

console.log('\n📦 Checking vendor libraries...');
// Check 5: Vendor file sizes (to ensure they're not empty/corrupted)
const vendorFiles = [
    { name: 'three.min.js', minSize: 500000 },
    { name: 'papaparse.min.js', minSize: 10000 },
    { name: '3d-force-graph.min.js', minSize: 100000 }
];

for (const vendor of vendorFiles) {
    const vendorPath = path.join(VIZ_DIR, 'vendor', vendor.name);
    if (fs.existsSync(vendorPath)) {
        const stats = fs.statSync(vendorPath);
        if (stats.size >= vendor.minSize) {
            pass(`${vendor.name}: ${(stats.size / 1024).toFixed(0)}KB (looks good)`);
        } else {
            warn(`${vendor.name}: Only ${(stats.size / 1024).toFixed(0)}KB (may be corrupted)`);
        }
    }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Summary:');
console.log(`   ✅ Passed: ${checks.passed}`);
console.log(`   ⚠️  Warnings: ${checks.warnings}`);
console.log(`   ❌ Failed: ${checks.failed}`);
console.log('='.repeat(50));

if (checks.failed > 0) {
    console.log('\n⚠️  Some checks failed. Please review the issues above.');
    process.exit(1);
} else if (checks.warnings > 0) {
    console.log('\n✅ All critical checks passed, but there are some warnings.');
    process.exit(0);
} else {
    console.log('\n✅ All checks passed! The visualization should work correctly.');
    process.exit(0);
}
