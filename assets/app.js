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
$('url-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const ref = parseCampaignUrl($('url-input').value);
  $('url-error').hidden = !!ref;
  if (!ref) {
    $('url-error').textContent = 'That doesn’t look like a campaign link. It should look like kickstarter.com/projects/creator/campaign or gamefound.com/en/projects/creator/campaign.';
    return;
  }
  const target = ref.platform === 'kickstarter' ? `${ref.url}/posts` : `${ref.url}/updates`;
  if (/Android/.test(navigator.userAgent)) {
    // Force Chrome instead of letting the Kickstarter/Gamefound app grab the link.
    const u = new URL(target);
    location.href = `intent://${u.host}${u.pathname}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(target)};end`;
  } else {
    window.open(target, '_blank', 'noopener');
  }
});

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
