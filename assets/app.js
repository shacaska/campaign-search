import { parseCampaignUrl, campaignDataPath, PLATFORM_NAMES } from './campaign-url.js';
import { prepare, search, highlight, snippets, escapeHtml } from './search.js';

// ---------- config: where the data lives ----------
// On GitHub Pages we read data straight from the repo (raw.githubusercontent.com), so newly
// indexed campaigns appear without waiting for a Pages rebuild. Locally we read ./data/.
const host = location.hostname;
let OWNER = 'shacaska';
let REPO = 'campaign-search';
if (host.endsWith('.github.io')) {
  OWNER = host.split('.')[0];
  REPO = location.pathname.split('/').filter(Boolean)[0] || `${OWNER}.github.io`;
}
const ON_PAGES = host.endsWith('.github.io');
const DATA = ON_PAGES ? `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/data/` : './data/';
const REPO_URL = `https://github.com/${OWNER}/${REPO}`;

const $ = (id) => document.getElementById(id);
const views = { pick: $('pick'), campaign: $('campaign'), about: $('about') };

let manifest = [];
let current = null; // {meta, data, prepared}
let pollTimer = null;

$('repo-link').href = REPO_URL;

async function getJSON(path, fresh = false) {
  const url = DATA + path + (fresh ? `?t=${Date.now()}` : '');
  const r = await fetch(url, { cache: fresh ? 'no-store' : 'default' });
  if (!r.ok) throw new Error(`${r.status} loading ${path}`);
  return r.json();
}

function show(name) {
  for (const [k, el] of Object.entries(views)) el.hidden = k !== name;
  window.scrollTo(0, 0);
}

// ---------- routing via ?c=<id>&q=<query> / #about ----------
function readState() {
  const p = new URLSearchParams(location.search);
  return { c: p.get('c'), q: p.get('q') || '', about: location.hash === '#about' || location.hash === '#bookmarklet' };
}

function writeState(c, q, push = false) {
  const p = new URLSearchParams();
  if (c) p.set('c', c);
  if (q) p.set('q', q);
  const url = location.pathname + (p.toString() ? '?' + p : '');
  history[push ? 'pushState' : 'replaceState'](null, '', url);
}

async function route() {
  const st = readState();
  if (st.about) { show('about'); if (location.hash === '#bookmarklet') $('bookmarklet').scrollIntoView(); return; }
  if (st.c) { await openCampaign(st.c, st.q); return; }
  show('pick');
  document.title = 'Campaign Update Search';
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-nav]');
  if (!a) return;
  e.preventDefault();
  if (a.dataset.nav === 'about') history.pushState(null, '', location.pathname + '#about');
  else history.pushState(null, '', location.pathname);
  route();
});
window.addEventListener('popstate', route);

// ---------- campaign list ----------
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

async function loadManifest(fresh = false) {
  try {
    manifest = await getJSON('campaigns.json', fresh);
  } catch {
    manifest = [];
  }
  renderList();
  return manifest;
}

function renderList() {
  const f = $('filter').value.trim().toLowerCase();
  $('filter').hidden = manifest.length < 6;
  const items = manifest
    .filter((m) => !f || m.name.toLowerCase().includes(f) || m.id.includes(f))
    .sort((a, b) => a.name.localeCompare(b.name));
  $('campaign-list').innerHTML = items.length
    ? items.map((m) => `<li><a href="?c=${encodeURIComponent(m.id)}" data-id="${escapeHtml(m.id)}">
        <span class="cl-name">${escapeHtml(m.name)}</span>
        <span class="cl-meta"><span class="pill ${m.platform}">${PLATFORM_NAMES[m.platform]}</span> ${m.updateCount} updates · refreshed ${ago(m.fetchedAt)}</span>
      </a></li>`).join('')
    : `<li class="muted">${manifest.length ? 'No match.' : 'Nothing indexed yet. Paste a campaign link above to add the first one.'}</li>`;
}

$('filter').addEventListener('input', renderList);
$('campaign-list').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-id]');
  if (!a) return;
  e.preventDefault();
  writeState(a.dataset.id, '', true);
  openCampaign(a.dataset.id, '');
});

// ---------- URL submit ----------
$('url-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  stopPolling();
  $('url-error').hidden = true;
  $('not-indexed').hidden = true;
  const ref = parseCampaignUrl($('url-input').value);
  if (!ref) {
    $('url-error').textContent = 'That doesn’t look like a Kickstarter or Gamefound campaign link. It should look like kickstarter.com/projects/creator/campaign or gamefound.com/en/projects/creator/campaign.';
    $('url-error').hidden = false;
    return;
  }
  await loadManifest(true);
  if (manifest.some((m) => m.id === ref.id)) {
    writeState(ref.id, '', true);
    openCampaign(ref.id, '');
  } else {
    showNotIndexed(ref);
  }
});

function showNotIndexed(ref) {
  $('ni-name').textContent = `${ref.slug.replace(/-/g, ' ')} (${PLATFORM_NAMES[ref.platform]})`;
  const p = new URLSearchParams({ template: 'index-campaign.yml', title: `Index: ${ref.slug}`, url: ref.url });
  $('ni-request').href = `${REPO_URL}/issues/new?${p}`;
  $('ni-request').onclick = () => startPolling(ref);
  $('ni-bookmarklet').onclick = () => { history.pushState(null, '', location.pathname + '#bookmarklet'); route(); };
  $('ni-wait').hidden = true;
  $('not-indexed').hidden = false;
}

function startPolling(ref) {
  stopPolling();
  $('ni-wait').hidden = false;
  const started = Date.now();
  pollTimer = setInterval(async () => {
    if (Date.now() - started > 15 * 60 * 1000) return stopPolling();
    await loadManifest(true);
    if (manifest.some((m) => m.id === ref.id)) {
      stopPolling();
      writeState(ref.id, '', true);
      openCampaign(ref.id, '');
    }
  }, 20000);
}
function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

// ---------- campaign view ----------
async function openCampaign(id, q) {
  show('campaign');
  if (!current || current.data.id !== id) {
    $('c-name').textContent = 'Loading…';
    $('c-meta').textContent = '';
    $('results').innerHTML = '';
    $('summary').textContent = '';
    try {
      const data = await getJSON(campaignDataPath(id));
      setCampaign(data);
    } catch (err) {
      $('c-name').textContent = 'Couldn’t load that campaign';
      $('c-meta').textContent = String(err.message || err);
      return;
    }
  }
  $('q').value = q || '';
  runSearch();
  if (!q) $('q').focus({ preventScroll: true });
}

function setCampaign(data) {
  current = { data, prepared: prepare(data.updates) };
  const locked = data.updates.filter((u) => u.locked).length;
  document.title = `${data.name} · Campaign Update Search`;
  $('c-name').textContent = data.name;
  $('c-meta').innerHTML = `<span class="pill ${data.platform}">${PLATFORM_NAMES[data.platform] || 'Local file'}</span>
    ${data.updates.length} updates · refreshed ${ago(data.fetchedAt)} ·
    <a href="${escapeHtml(data.url)}" target="_blank" rel="noopener">campaign page ↗</a>`;
  $('locked-note').hidden = !locked;
  $('locked-note').innerHTML = locked
    ? `${locked} backer-only update${locked > 1 ? 's are' : ' is'} listed by title only. To search their text, <a href="#bookmarklet" data-nav="about">use the bookmarklet</a> while logged in as a backer.`
    : '';
}

let debounce;
$('q').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(runSearch, 120); });
$('search-form').addEventListener('submit', (e) => { e.preventDefault(); runSearch(); $('q').blur(); });
$('mode').addEventListener('change', runSearch);
$('sort').addEventListener('change', runSearch);

function updateLabel(u) {
  const n = u.n != null ? `#${u.n}` : '';
  return `${n}${n && u.date ? ' · ' : ''}${fmtDate(u.date)}`;
}

function runSearch() {
  if (!current) return;
  const q = $('q').value;
  writeState(current.data.id, q.trim());
  const { results, totalMentions, parsed } = search(current.prepared, q, $('mode').value);
  const sort = $('sort').value;
  if (sort === 'relevance') results.sort((a, b) => b.score - a.score || (b.update.date || '').localeCompare(a.update.date || ''));
  else if (sort === 'newest') results.sort((a, b) => (b.update.date || '').localeCompare(a.update.date || ''));
  else results.sort((a, b) => (a.update.date || '').localeCompare(b.update.date || ''));

  const total = current.data.updates.length;
  if (!parsed.terms.length) {
    $('summary').textContent = '';
    $('results').innerHTML = '';
    renderBrowse(true);
    return;
  }
  renderBrowse(false);
  $('summary').innerHTML = results.length
    ? `Found in <strong>${results.length}</strong> of ${total} updates · ${totalMentions} mention${totalMentions === 1 ? '' : 's'}`
    : `No updates mention ${parsed.terms.map((t) => `<strong>${escapeHtml(t)}</strong>`).join(mode() === 'all' ? ' and ' : ' or ')}.`;
  $('results').innerHTML = results.map(renderResult).join('');
}
const mode = () => $('mode').value;

function renderResult(r, i) {
  const u = r.update;
  const sn = snippets(u.text, r.ranges);
  const shown = sn.slice(0, 3);
  const more = sn.length - shown.length;
  const platform = PLATFORM_NAMES[current.data.platform] || 'original';
  return `<li class="result" data-i="${i}">
    <div class="r-head">
      <span class="r-label">${escapeHtml(updateLabel(u))}${u.public === false ? ' · <span class="lock" title="Backers only">🔒 backers</span>' : ''}</span>
      <span class="count" title="mentions">${r.mentions}×</span>
    </div>
    <h3><a href="${escapeHtml(u.url)}" target="_blank" rel="noopener">${highlight(u.title || '(untitled)', r.titleRanges)}</a></h3>
    ${shown.map((s) => `<p class="snip">${s.html}</p>`).join('')}
    <div class="r-actions">
      ${more > 0 ? `<button type="button" class="link more" data-act="more">+${more} more match${more > 1 ? 'es' : ''}</button>` : ''}
      ${u.text ? `<button type="button" class="link" data-act="full">Read full update</button>` : ''}
      <a class="link" href="${escapeHtml(u.url)}" target="_blank" rel="noopener">Open on ${platform} ↗</a>
    </div>
    <div class="full" hidden></div>
  </li>`;
}

let lastResults = null;
$('results').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const li = btn.closest('.result');
  const { results } = search(current.prepared, $('q').value, $('mode').value);
  const id = li.querySelector('h3 a').getAttribute('href');
  const r = results.find((x) => x.update.url === id) || results[+li.dataset.i];
  if (!r) return;
  if (btn.dataset.act === 'more') {
    const sn = snippets(r.update.text, r.ranges);
    const snipEls = li.querySelectorAll('.snip');
    const last = snipEls[snipEls.length - 1];
    last.insertAdjacentHTML('afterend', sn.slice(3).map((s) => `<p class="snip">${s.html}</p>`).join(''));
    btn.remove();
  } else if (btn.dataset.act === 'full') {
    const full = li.querySelector('.full');
    if (full.hidden) {
      full.innerHTML = paragraphs(r.update.text, r.ranges);
      full.hidden = false;
      btn.textContent = 'Hide full update';
      full.querySelector('mark')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      full.hidden = true;
      btn.textContent = 'Read full update';
      li.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }
});

function paragraphs(text, ranges) {
  const out = [];
  let pos = 0;
  for (const block of text.split('\n\n')) {
    const start = text.indexOf(block, pos);
    const end = start + block.length;
    out.push(`<p>${highlight(text, ranges, start, end).replace(/\n/g, '<br>')}</p>`);
    pos = end;
  }
  return out.join('');
}

function renderBrowse(visible) {
  $('browse').hidden = !visible;
  if (!visible) return;
  const ups = [...current.data.updates].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  $('all-updates').innerHTML = ups.map((u) => `<li>
    <a href="${escapeHtml(u.url)}" target="_blank" rel="noopener">${escapeHtml(u.title || '(untitled)')}</a>
    <span class="muted">${escapeHtml(updateLabel(u))}${u.locked ? ' · 🔒 backers only' : ''}</span></li>`).join('');
}

// ---------- local file (from the bookmarklet's "Save") ----------
$('file-input').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.updates)) throw new Error('No updates in that file');
    data.id = data.id || 'local';
    show('campaign');
    setCampaign(data);
    $('q').value = '';
    runSearch();
    $('q').focus();
  } catch (err) {
    alert('Couldn’t read that file: ' + err.message);
  }
});

// ---------- bookmarklet link ----------
(async () => {
  try {
    const code = await (await fetch('assets/bookmarklet.txt')).text();
    $('bm-link').href = code.trim();
    $('bm-link').removeAttribute('onclick');
    $('bm-link').addEventListener('click', (e) => { e.preventDefault(); alert('Drag this button to your bookmarks bar, then click it while on a campaign page.'); });
    $('bm-copy').onclick = async () => {
      await navigator.clipboard.writeText(code.trim());
      $('bm-copy').textContent = 'Copied ✓';
    };
  } catch {}
})();

loadManifest().then(route);
