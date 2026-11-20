// Builds the bookmarklet (assets/bookmarklet.txt) and the userscript (campaign-search.user.js).
// Run: npm install && npm run build
import { build } from 'esbuild';
import { writeFile, readFile } from 'node:fs/promises';

const common = { bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' };

const bm = await build({ ...common, entryPoints: ['src/bookmarklet.js'] });
const code = bm.outputFiles[0].text.trim();
// Minimal escaping keeps it small: browsers percent-decode javascript: URLs, so escape % first.
const href = 'javascript:' + code.replace(/%/g, '%25').replace(/#/g, '%23').replace(/\n/g, '%0A');
await writeFile('assets/bookmarklet.txt', href + '\n');

const pkgVersion = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
const header = `// ==UserScript==
// @name         Campaign Update Search
// @namespace    https://shacaska.github.io/campaign-search/
// @version      ${pkgVersion}
// @description  Adds a "Search updates" button to Kickstarter and Gamefound campaign pages that searches the full text of every update.
// @match        https://www.kickstarter.com/projects/*
// @match        https://gamefound.com/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://shacaska.github.io/campaign-search/campaign-search.user.js
// @updateURL    https://shacaska.github.io/campaign-search/campaign-search.user.js
// ==/UserScript==
`;
const us = await build({ ...common, entryPoints: ['src/userscript.js'] });
await writeFile('campaign-search.user.js', header + us.outputFiles[0].text);

console.log(`bookmarklet: ${(href.length / 1024).toFixed(1)} KB, userscript: ${(us.outputFiles[0].text.length / 1024).toFixed(1)} KB`);
