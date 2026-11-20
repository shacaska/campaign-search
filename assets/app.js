import { parseCampaignUrl, PLATFORM_NAMES } from './campaign-url.js';
import { prepare, search, highlight, snippets, escapeHtml } from './search.js';

const $ = (id) => document.getElementById(id);

// ---------- repo links ----------
let REPO_URL = 'https://github.com/shacaska/campaign-search';
if (location.hostname.endsWith('.github.io')) {
  const owner = location.hostname.split('.')[0];
  const repo = location.pathname.split('/').filter(Boolean)[0];
  if (repo) REPO_URL = `https://github.com/${owner}/${repo}`;
}
$('repo-link').href = REPO_URL;
$('issues-link').href = `${REPO_URL}/issues/new`;

// ---------- install tabs (pick a sensible default) ----------
function selectTab(name) {
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== name));
}
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
const ua = navigator.userAgent;
if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) selectTab('iphone');
else if (/Android/.test(ua)) selectTab('android');

// ---------- bookmarklet ----------
const codes = { loader: '', full: '' };
(async () => {
  try {
    const [a, b] = await Promise.all(['bookmarklet.txt', 'bookmarklet-full.txt'].map((f) => fetch('assets/' + f, { cache: 'no-cache' }).then((r) => r.text())));
    codes.loader = a.trim();
    codes.full = b.trim();
    $('bm-link').href = codes.loader;
  } catch {}
})();
$('bm-link').addEventListener('click', (e) => {
  e.preventDefault();
  alert('Drag this button onto your bookmarks bar. Then click it while you’re on a Kickstarter or Gamefound campaign page.');
});
document.querySelectorAll('[data-copy]').forEach((btn) =>
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy === 'full' ? codes.full : codes.loader);
      btn.textContent = 'Copied ✓';
    } catch {
      prompt('Copy this code:', btn.dataset.copy === 'full' ? codes.full : codes.loader);
    }
  }),
);

// ---------- open a campaign ----------
const IS_ANDROID = /Android/.test(ua);

// Which Android browser are we in? (An installed app reports the browser that installed it.)
function browserPackage() {
  if (/SamsungBrowser/.test(ua)) return 'com.sec.android.app.sbrowser';
  if (/EdgA\//.test(ua)) return 'com.microsoft.emmx';
  if (/Firefox\//.test(ua)) return 'org.mozilla.firefox';
  if (/OPR\//.test(ua)) return 'com.opera.browser';
  if (navigator.brave) return 'com.brave.browser';
  return 'com.android.chrome';
}

// On Android, an intent:// link pinned to the browser package stops the Kickstarter/Gamefound
// app from grabbing the link. Elsewhere a normal link is fine.
function openInBrowser(target, newTab = true) {
  if (IS_ANDROID) {
    const u = new URL(target);
    location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=${browserPackage()};S.browser_fallback_url=${encodeURIComponent(target)};end`;
  } else if (newTab) {
    window.open(target, '_blank', 'noopener');
  } else {
    location.href = target;
  }
}

const updatesPage = (ref) => (ref.platform === 'kickstarter' ? `${ref.url}/posts` : `${ref.url}/updates`);

$('url-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const ref = parseCampaignUrl($('url-input').value);
  $('url-error').hidden = !!ref;
  if (!ref) {
    $('url-error').textContent = 'That doesn’t look like a campaign link. It should look like kickstarter.com/projects/creator/campaign or gamefound.com/en/projects/creator/campaign.';
    return;
  }
  openInBrowser(updatesPage(ref));
});

// ---------- links shared to the installed app (Android Share menu) ----------
function handleShare() {
  const p = new URLSearchParams(location.search);
  const shared = ['url', 'text', 'title'].map((k) => p.get(k) || '').join(' ').trim();
  if (!shared) return;
  history.replaceState(null, '', location.pathname); // don't re-open on refresh
  const links = shared.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  let target = null;
  let label = '';
  for (const l of links) {
    const ref = parseCampaignUrl(l);
    if (ref) { target = updatesPage(ref); label = ref.slug.replace(/-/g, ' '); break; }
  }
  // Kickstarter's app often shares a kck.st short link: open it and let it redirect.
  if (!target) {
    const short = links.find((l) => /^https?:\/\/([a-z0-9-]+\.)*(kck\.st|kickstarter\.com|gamefound\.com)(\/|$)/i.test(l));
    if (short) { target = short; label = 'the shared campaign'; }
  }
  const card = $('shared');
  card.hidden = false;
  if (!target) {
    $('shared-msg').textContent = 'That share didn’t include a Kickstarter or Gamefound link.';
    $('shared-open').hidden = true;
    return;
  }
  $('shared-msg').textContent = `Opening ${label} in your browser. Then tap your search bookmark.`;
  $('shared-open').onclick = () => openInBrowser(target, false);
  openInBrowser(target, false);
}
handleShare();

// ---------- install as an app ----------
const STANDALONE = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  $('install-btn').hidden = false;
});
$('install-btn').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('install-btn').hidden = true;
});
window.addEventListener('appinstalled', () => { $('install-card').hidden = true; });
if (STANDALONE) $('install-card').hidden = true;
$('install-how').textContent = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  ? 'In Safari: Share → Add to Home Screen. (iPhone doesn’t let web apps appear in the Share menu, so this just gives you a home-screen shortcut.)'
  : IS_ANDROID
    ? 'Or in your browser menu (⋮): Add to Home screen → Install. Then in the Kickstarter or Gamefound app, tap Share → Campaign Search.'
    : 'Or use the install icon at the right of your browser’s address bar.';

// ---------- saved-file viewer ----------
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
let current = null;

$('file-input').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.updates)) throw new Error('no updates in that file');
    openViewer(data);
  } catch (err) {
    alert('Couldn’t read that file: ' + err.message);
  }
});

function openViewer(data) {
  current = { data, prepared: prepare(data.updates) };
  $('home').hidden = true;
  $('campaign').hidden = false;
  document.title = `${data.name} · Campaign Update Search`;
  $('c-name').textContent = data.name;
  $('c-meta').innerHTML = `<span class="pill ${escapeHtml(data.platform)}">${PLATFORM_NAMES[data.platform] || 'Saved'}</span>
    ${data.updates.length} updates · saved ${fmtDate(data.fetchedAt)} ·
    <a href="${escapeHtml(data.url)}" target="_blank" rel="noopener">campaign page ↗</a>`;
  $('q').value = '';
  runSearch();
  $('q').focus();
  window.scrollTo(0, 0);
}

let debounce;
$('q').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(runSearch, 120); });
$('search-form').addEventListener('submit', (e) => { e.preventDefault(); runSearch(); $('q').blur(); });
$('mode').addEventListener('change', runSearch);
$('sort').addEventListener('change', runSearch);

const label = (u) => `${u.n != null ? '#' + u.n : ''}${u.n != null && u.date ? ' · ' : ''}${fmtDate(u.date)}`;
let lastResults = [];

function runSearch() {
  if (!current) return;
  const mode = $('mode').value;
  const { results, totalMentions, parsed } = search(current.prepared, $('q').value, mode);
  const sort = $('sort').value;
  const byDate = (a, b) => (a.update.date || '').localeCompare(b.update.date || '');
  if (sort === 'relevance') results.sort((a, b) => b.score - a.score || -byDate(a, b));
  else if (sort === 'newest') results.sort((a, b) => -byDate(a, b));
  else results.sort(byDate);
  lastResults = results;

  const total = current.data.updates.length;
  $('browse').hidden = !!parsed.terms.length;
  if (!parsed.terms.length) {
    $('summary').textContent = '';
    $('results').innerHTML = '';
    const ups = [...current.data.updates].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('all-updates').innerHTML = ups.map((u) => `<li><a href="${escapeHtml(u.url)}" target="_blank" rel="noopener">${escapeHtml(u.title || '(untitled)')}</a>
      <span class="muted">${escapeHtml(label(u))}${u.locked ? ' · 🔒 backers only' : ''}</span></li>`).join('');
    return;
  }
  $('summary').innerHTML = results.length
    ? `Found in <strong>${results.length}</strong> of ${total} updates · ${totalMentions} mention${totalMentions === 1 ? '' : 's'}`
    : `No updates mention ${parsed.terms.map((t) => `<strong>${escapeHtml(t)}</strong>`).join(mode === 'all' ? ' and ' : ' or ')}.`;
  $('results').innerHTML = results.map((r, i) => {
    const u = r.update;
    const sn = snippets(u.text, r.ranges);
    return `<li class="result" data-i="${i}">
      <div class="r-head"><span>${escapeHtml(label(u))}${u.locked ? ' · 🔒' : ''}</span><span class="count">${r.mentions}×</span></div>
      <h3><a href="${escapeHtml(u.url)}" target="_blank" rel="noopener">${highlight(u.title || '(untitled)', r.titleRanges)}</a></h3>
      ${sn.slice(0, 3).map((s) => `<p class="snip">${s.html}</p>`).join('')}
      <div class="r-actions">
        ${sn.length > 3 ? `<button type="button" class="link" data-act="more">+${sn.length - 3} more</button>` : ''}
        ${u.text ? '<button type="button" class="link" data-act="full">Read full update</button>' : ''}
        <a class="link" href="${escapeHtml(u.url)}" target="_blank" rel="noopener">Open original ↗</a>
      </div>
      <div class="full" hidden></div>
    </li>`;
  }).join('');
}

$('results').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const li = btn.closest('.result');
  const r = lastResults[+li.dataset.i];
  if (!r) return;
  if (btn.dataset.act === 'more') {
    const extra = snippets(r.update.text, r.ranges).slice(3).map((s) => `<p class="snip">${s.html}</p>`).join('');
    [...li.querySelectorAll('.snip')].pop().insertAdjacentHTML('afterend', extra);
    btn.remove();
    return;
  }
  const full = li.querySelector('.full');
  if (full.hidden) {
    const t = r.update.text;
    let pos = 0;
    full.innerHTML = t.split('\n\n').map((blk) => {
      const s = t.indexOf(blk, pos);
      pos = s + blk.length;
      return `<p>${highlight(t, r.ranges, s, s + blk.length).replace(/\n/g, '<br>')}</p>`;
    }).join('');
    full.hidden = false;
    btn.textContent = 'Hide full update';
    full.querySelector('mark')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else {
    full.hidden = true;
    btn.textContent = 'Read full update';
  }
});
