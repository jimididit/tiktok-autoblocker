#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function fail(message) {
    console.error('Version check failed:', message);
    process.exit(1);
}

const manifest = JSON.parse(read('chrome-extension/manifest.json'));
const expected = String(manifest.version || '').trim();
if (!/^\d+\.\d+\.\d+$/.test(expected)) {
    fail('manifest.json version must look like X.Y.Z, got: ' + JSON.stringify(manifest.version));
}

const checks = [
    {
        file: 'chrome-extension/popup.html',
        re: /<strong>v(\d+\.\d+\.\d+)<\/strong>/,
        label: 'popup footer'
    },
    {
        file: 'tampermonkey/script.js',
        re: /\/\/\s*@version\s+(\d+\.\d+\.\d+)/,
        label: 'Tampermonkey @version'
    },
    {
        file: 'tampermonkey/script.js',
        re: /<strong>v(\d+\.\d+\.\d+)<\/strong>/,
        label: 'Tampermonkey panel footer'
    },
    {
        file: 'README.md',
        re: /version-(\d+\.\d+\.\d+)-ff4757/,
        label: 'README badge'
    }
];

let ok = true;
for (const check of checks) {
    const text = read(check.file);
    const match = text.match(check.re);
    if (!match) {
        console.error('- missing ' + check.label + ' in ' + check.file);
        ok = false;
        continue;
    }
    if (match[1] !== expected) {
        console.error('- ' + check.label + ' is ' + match[1] + ', expected ' + expected + ' (' + check.file + ')');
        ok = false;
        continue;
    }
    console.log('ok  ' + check.label + ' = ' + match[1]);
}

if (!ok) {
    fail('versions must match chrome-extension/manifest.json (' + expected + ')');
}

console.log('All versions match ' + expected);
