// Builds:
//   assets/panel.js           the full search panel (loaded by the short bookmarklet)
//   assets/bookmarklet.txt    short loader bookmarklet (~0.4 KB) — what people install
//   assets/bookmarklet-full.txt  self-contained bookmarklet, for sites that block the loader
//   campaign-search.user.js   userscript (Tampermonkey / Violentmonkey / Userscripts)
// Run: npm install && npm run build
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';

const SITE = 'https://shacaska.github.io/campaign-search/';
const common = { bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' };
// Browsers percent-decode javascript: URLs, so escape % first (and # / newlines to be safe).
// esbuild folds escapes like \u0300 inside regexes back into raw characters. Re-escape every
// non-ASCII character so the output is pure ASCII and can't be mis-decoded under any page charset.
const ascii = (code) => code.replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const toHref = (code) => 'javascript:' + code.trim().replace(/%/g, '%25').replace(/#/g, '%23').replace(/\n/g, '%0A');

const panel = ascii((await build({ ...common, charset: 'ascii', entryPoints: ['src/bookmarklet.js'] })).outputFiles[0].text.trim());
await writeFile('assets/panel.js', panel + '\n');
await writeFile('assets/bookmarklet-full.txt', toHref(panel) + '\n');

// Loader: try a normal <script src>; if the page's security policy blocks that, fetch the code and
// run it directly; if that's blocked too, say so instead of failing silently.
const loader = `(function(){var u='${SITE}assets/panel.js?v='+Date.now(),d=document,s=d.createElement('script');s.src=u;s.onerror=function(){fetch(u).then(function(r){if(!r.ok)throw r.status;return r.text()}).then(function(t){(0,eval)(t)}).catch(function(e){alert('Campaign Search could not load on this page ('+e+'). Try the standalone version from the site.')})};(d.body||d.documentElement).appendChild(s)})()`;
await writeFile('assets/bookmarklet.txt', toHref(loader) + '\n');

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
const header = `// ==UserScript==
// @name         Campaign Update Search
// @namespace    ${SITE}
// @version      ${stamp}
// @description  Adds a "Search updates" button to Kickstarter and Gamefound campaign pages that searches the full text of every update.
// @match        https://www.kickstarter.com/projects/*
// @match        https://gamefound.com/*
// @grant        none
// @run-at       document-idle
// @downloadURL  ${SITE}campaign-search.user.js
// @updateURL    ${SITE}campaign-search.user.js
// ==/UserScript==
`;
const us = ascii((await build({ ...common, charset: 'ascii', entryPoints: ['src/userscript.js'] })).outputFiles[0].text);
await writeFile('campaign-search.user.js', header + us);

console.log(`loader bookmarklet: ${toHref(loader).length} chars, panel.js: ${(panel.length / 1024).toFixed(1)} KB, standalone: ${(toHref(panel).length / 1024).toFixed(1)} KB`);
