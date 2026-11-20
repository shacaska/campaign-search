// The in-page search panel opened by the bookmarklet / userscript.
// Runs on kickstarter.com or gamefound.com, fetches every update with the user's own session,
// caches it in this site's localStorage, and searches it instantly.

import { parseCampaignUrl, PLATFORM_NAMES } from './campaign-url.js';
import { prepare, search, highlight, snippets, escapeHtml } from './search.js';
import { fetchKickstarterUpdates } from './kickstarter-core.js';
import { fetchGamefoundUpdates } from './gamefound-core.js';

const VERSION = 1;
const SITE = 'https://shacaska.github.io/campaign-search/';
const KEY = (id) => `campaign-search:v${VERSION}:${id}`;

// ---------- transports (same-origin, user's own session) ----------
async function kickstarterGraph(ref) {
  let csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  if (!csrf) {
    const html = await (await fetch(ref.url, { credentials: 'same-origin' })).text();
    csrf = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/)?.[1];
  }
  return async (body) => {
    const r = await fetch('/graph', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = new Error(`Kickstarter answered HTTP ${r.status}. Try reloading the page and running it again.`);
      e.fatal = r.status === 403 || r.status === 429;
      throw e;
    }
    return r.json();
  };
}

async function gamefoundHttp(url, init = {}) {
  const r = await fetch(url, { credentials: 'same-origin', ...init });
  if (!r.ok) {
    const e = new Error(`Gamefound answered HTTP ${r.status} for ${url}`);
    e.status = r.status;
    throw e;
  }
  return r.text();
}

async function fetchHere(ref, cached, onProgress) {
  if (ref.platform === 'kickstarter') {
    return fetchKickstarterUpdates(ref, await kickstarterGraph(ref), { onProgress, delayMs: 150 });
  }
  const known = new Map((cached?.updates || []).map((u) => [u.url, u]));
  return fetchGamefoundUpdates(ref, gamefoundHttp, { onProgress, delayMs: 150, known });
}

// ---------- storage ----------
function loadCache(id) {
  try { return JSON.parse(localStorage.getItem(KEY(id)) || 'null'); } catch { return null; }
}
function saveCache(data) {
  try { localStorage.setItem(KEY(data.id), JSON.stringify(data)); return true; } catch { return false; }
}

// ---------- safe HTML setter (copes with sites that enforce Trusted Types) ----------
let ttPolicy;
function setHTML(el, html) {
  try { el.innerHTML = html; return; } catch {}
  try {
    ttPolicy ||= window.trustedTypes.createPolicy('campaign-search', { createHTML: (s) => s });
    el.innerHTML = ttPolicy.createHTML(html);
  } catch {
    el.textContent = '';
  }
}

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.wrap { position: fixed; z-index: 2147483646; top: 0; right: 0; bottom: 0; width: min(460px, 100vw);
  display: flex; flex-direction: column; background: #fffdf8; color: #1f1b16;
  font: 15px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  box-shadow: -8px 0 40px rgba(0,0,0,.25); border-left: 1px solid #e2d9c9; }
@media (prefers-color-scheme: dark) {
  .wrap { background: #1e1b16; color: #ece5d8; border-color: #342e25; }
  input, select { background: #15130f !important; color: #ece5d8 !important; border-color: #342e25 !important; }
  .res { border-color: #342e25 !important; }
  .snip { color: #d8cfbf !important; border-color: #342e25 !important; }
  mark { background: #8a6a12 !important; }
  .bar { background: #342e25 !important; }
  .head, .foot { border-color: #342e25 !important; }
}
.head { padding: 12px 14px 10px; border-bottom: 1px solid #e2d9c9; }
.top { display: flex; align-items: center; gap: 8px; }
.title { flex: 1; font-weight: 700; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.x { border: 0; background: transparent; font-size: 22px; line-height: 1; cursor: pointer; color: inherit; padding: 4px 8px; }
.sub { font-size: 12px; opacity: .7; margin-top: 2px; }
.row { display: flex; gap: 6px; margin-top: 10px; }
input { flex: 1; min-width: 0; font: inherit; font-size: 16px; padding: 10px 12px; border: 1.5px solid #e2d9c9; border-radius: 10px; background: #fff; color: #1f1b16; }
input:focus { outline: none; border-color: #9a5b1e; }
select { font: inherit; font-size: 13px; padding: 6px; border: 1.5px solid #e2d9c9; border-radius: 10px; background: #fff; color: #1f1b16; }
.bar { height: 4px; background: #eee5d6; border-radius: 4px; margin-top: 10px; overflow: hidden; }
.bar > i { display: block; height: 100%; width: 0; background: #9a5b1e; transition: width .2s; }
.status { font-size: 12.5px; margin-top: 6px; opacity: .85; }
.status.err { color: #c0392b; opacity: 1; }
.body { flex: 1; overflow: auto; padding: 10px 14px 20px; -webkit-overflow-scrolling: touch; }
.sum { font-size: 13px; margin: 2px 0 10px; }
.res { border: 1.5px solid #e2d9c9; border-radius: 10px; padding: 9px 12px; margin-bottom: 10px; }
.meta { display: flex; justify-content: space-between; font-size: 12px; opacity: .75; }
.cnt { font-weight: 700; color: #9a5b1e; }
.rt { display: block; font-weight: 650; margin: 2px 0 4px; color: inherit; text-decoration: none; }
.rt:hover { text-decoration: underline; }
.snip { font-size: 13.5px; margin: 5px 0; padding-left: 8px; border-left: 3px solid #e2d9c9; color: #3d362d; overflow-wrap: anywhere; }
mark { background: #ffd86b; color: inherit; border-radius: 2px; }
.acts { display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 13px; margin-top: 4px; }
.acts a, .acts button { color: #9a5b1e; font: inherit; font-weight: 600; background: none; border: 0; padding: 3px 0; cursor: pointer; text-decoration: none; }
.full { font-size: 14px; margin-top: 8px; border-top: 1px dashed #e2d9c9; padding-top: 4px; overflow-wrap: anywhere; }
.full p { margin: .55em 0; }
.foot { border-top: 1px solid #e2d9c9; padding: 8px 14px; display: flex; gap: 14px; font-size: 12.5px; align-items: center; flex-wrap: wrap; }
.foot button, .foot a { font: inherit; color: #9a5b1e; background: none; border: 0; padding: 4px 0; cursor: pointer; font-weight: 600; text-decoration: none; }
.hint { font-size: 12px; opacity: .65; margin-top: 6px; }
.empty { opacity: .7; font-size: 14px; }
`;

function styleInto(root) {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
  } catch {
    const s = document.createElement('style');
    s.textContent = CSS;
    root.appendChild(s);
  }
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function openOverlay() {
  const existing = window.__campaignSearch;
  if (existing?.host?.isConnected) {
    existing.host.style.display = existing.host.style.display === 'none' ? '' : 'none';
    existing.focus?.();
    return;
  }

  const ref = parseCampaignUrl(location.href);
  const host = document.createElement('div');
  host.id = 'campaign-search-panel';
  const root = host.attachShadow({ mode: 'open' });
  styleInto(root);
  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  root.appendChild(wrap);
  document.documentElement.appendChild(host);
  const state = { host, data: null, prepared: null };
  window.__campaignSearch = state;

  if (!ref) {
    setHTML(wrap, `<div class="head"><div class="top"><div class="title">Campaign Search</div><button class="x" title="Close">×</button></div></div>
      <div class="body"><p>Open a <b>Kickstarter</b> or <b>Gamefound</b> campaign page first, then run this again.</p>
      <p class="empty">Examples:<br>kickstarter.com/projects/<i>creator</i>/<i>campaign</i><br>gamefound.com/en/projects/<i>creator</i>/<i>campaign</i></p></div>`);
    wrap.querySelector('.x').onclick = () => host.remove();
    return;
  }

  setHTML(wrap, `
    <div class="head">
      <div class="top"><div class="title">🔎 Search updates</div><button class="x" title="Close">×</button></div>
      <div class="sub" data-sub>${escapeHtml(PLATFORM_NAMES[ref.platform])}</div>
      <div class="row">
        <input type="search" placeholder="Search all updates… e.g. eidolon" enterkeyhint="search" data-q>
        <select data-sort title="Sort"><option value="relevance">Most hits</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select>
      </div>
      <div class="hint">"exact phrase" · -exclude · ignores case &amp; accents</div>
      <div class="bar" data-barwrap><i data-bar></i></div>
      <div class="status" data-status>Starting…</div>
    </div>
    <div class="body" data-body></div>
    <div class="foot">
      <button data-refresh>↻ Refresh</button>
      <button data-save>Save .json</button>
      <a href="${SITE}" target="_blank" rel="noopener">About</a>
    </div>`);

  const $ = (s) => wrap.querySelector(`[data-${s}]`);
  const q = $('q');
  const body = $('body');
  state.focus = () => q.focus();
  wrap.querySelector('.x').onclick = () => (host.style.display = 'none');
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') host.style.display = 'none'; e.stopPropagation(); });
  // Stop the host page's keyboard shortcuts from firing while typing
  ['keyup', 'keypress', 'input'].forEach((t) => root.addEventListener(t, (e) => e.stopPropagation()));

  const setStatus = (msg, err = false) => { $('status').textContent = msg; $('status').className = 'status' + (err ? ' err' : ''); };
  const setBar = (frac) => { $('barwrap').style.display = frac == null ? 'none' : ''; $('bar').style.width = `${Math.round((frac || 0) * 100)}%`; };

  function use(data, note) {
    state.data = data;
    state.prepared = prepare(data.updates);
    const locked = data.updates.filter((u) => u.locked).length;
    $('sub').textContent = `${data.name} · ${data.updates.length} updates`;
    setStatus(note + (locked ? ` · ${locked} locked (backers only — log in as a backer to include them)` : ''));
    render();
  }

  let busy = false;
  async function refresh() {
    if (busy) return;
    busy = true;
    setBar(0);
    const label = state.data ? 'Showing saved copy · checking for new updates…' : 'Fetching updates…';
    setStatus(label);
    try {
      const got = await fetchHere(ref, state.data, (done, total) => {
        setBar(total ? done / total : 0.5);
        setStatus(`${label} ${done}${total ? ' / ' + total : ''}`);
      });
      const data = { id: ref.id, platform: ref.platform, name: got.name, url: got.url, fetchedAt: new Date().toISOString(), updates: got.updates };
      const saved = saveCache(data);
      use(data, `Up to date · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${saved ? '' : ' (too big to cache)'}`);
    } catch (e) {
      console.error('[campaign-search]', e);
      setStatus((state.data ? 'Showing saved copy. Refresh failed: ' : 'Couldn’t fetch updates: ') + (e.message || e), true);
    } finally {
      busy = false;
      setBar(null);
    }
  }

  function render() {
    if (!state.data) return;
    const { results, totalMentions, parsed } = search(state.prepared, q.value, 'all');
    const sort = $('sort').value;
    const byDate = (a, b) => (a.update.date || '').localeCompare(b.update.date || '');
    if (sort === 'relevance') results.sort((a, b) => b.score - a.score || -byDate(a, b));
    else if (sort === 'newest') results.sort((a, b) => -byDate(a, b));
    else results.sort(byDate);

    if (!parsed.terms.length) {
      const ups = [...state.data.updates].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setHTML(body, `<p class="empty">Type to search ${ups.length} updates. All updates, newest first:</p>` +
        ups.map((u) => `<div class="res"><div class="meta"><span>${u.n != null ? '#' + u.n + ' · ' : ''}${fmtDate(u.date)}${u.locked ? ' · 🔒' : ''}</span></div>
          <a class="rt" href="${escapeHtml(u.url)}" target="_blank" rel="noopener">${escapeHtml(u.title || '(untitled)')}</a></div>`).join(''));
      return;
    }
    state.results = results;
    setHTML(body, `<p class="sum">${results.length
      ? `In <b>${results.length}</b> of ${state.data.updates.length} updates · ${totalMentions} mention${totalMentions === 1 ? '' : 's'}`
      : 'No matches.'}</p>` +
      results.map((r, i) => {
        const u = r.update;
        const sn = snippets(u.text, r.ranges);
        return `<div class="res" data-i="${i}">
          <div class="meta"><span>${u.n != null ? '#' + u.n + ' · ' : ''}${fmtDate(u.date)}${u.locked ? ' · 🔒' : ''}</span><span class="cnt">${r.mentions}×</span></div>
          <a class="rt" href="${escapeHtml(u.url)}" target="_blank" rel="noopener">${highlight(u.title || '(untitled)', r.titleRanges)}</a>
          ${sn.slice(0, 3).map((s) => `<div class="snip">${s.html}</div>`).join('')}
          <div class="acts">
            ${sn.length > 3 ? `<button data-act="more">+${sn.length - 3} more</button>` : ''}
            ${u.text ? '<button data-act="full">Read full update</button>' : ''}
            <a href="${escapeHtml(u.url)}" target="_blank" rel="noopener">Open ↗</a>
          </div><div class="full" hidden></div></div>`;
      }).join(''));
  }

  body.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const card = b.closest('.res');
    const r = state.results?.[+card.dataset.i];
    if (!r) return;
    if (b.dataset.act === 'more') {
      const sn = snippets(r.update.text, r.ranges).slice(3);
      const last = [...card.querySelectorAll('.snip')].pop();
      const tmp = document.createElement('div');
      setHTML(tmp, sn.map((s) => `<div class="snip">${s.html}</div>`).join(''));
      last.after(...tmp.childNodes);
      b.remove();
    } else {
      const full = card.querySelector('.full');
      if (full.hidden) {
        const t = r.update.text;
        let pos = 0;
        setHTML(full, t.split('\n\n').map((blk) => {
          const s = t.indexOf(blk, pos); pos = s + blk.length;
          return `<p>${highlight(t, r.ranges, s, s + blk.length).replace(/\n/g, '<br>')}</p>`;
        }).join(''));
        full.hidden = false;
        b.textContent = 'Hide full update';
        full.querySelector('mark')?.scrollIntoView({ block: 'center' });
      } else {
        full.hidden = true;
        b.textContent = 'Read full update';
      }
    }
  });

  let t;
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 120); });
  $('sort').addEventListener('change', render);
  $('refresh').onclick = refresh;
  $('save').onclick = () => {
    if (!state.data) return;
    const blob = new Blob([JSON.stringify(state.data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${ref.slug}-updates.json`;
    root.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  const cached = loadCache(ref.id);
  if (cached) use(cached, `Saved copy from ${fmtDate(cached.fetchedAt)} — checking for new updates…`);
  q.focus();
  refresh();
}
