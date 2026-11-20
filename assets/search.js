// Search core shared by the site and the bookmarklet.
// Case- and accent-insensitive substring search with phrase support ("eidolon box"),
// AND / OR modes, per-update mention counts and highlighted snippets.

// Fold one string to lowercase/no-accents while keeping a 1:1 index map back to the original.
function fold(str) {
  let out = '';
  const map = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    let f = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (f.length !== 1) f = f.length ? f[0] : ch;
    // Treat curly quotes/apostrophes and dashes as plain ones
    if (f === '’' || f === '‘') f = "'";
    else if (f === '“' || f === '”') f = '"';
    else if (f === '–' || f === '—') f = '-';
    out += f;
    map.push(i);
  }
  return { text: out, map };
}

export function foldTerm(t) {
  return fold(t).text;
}

// 'eidolon "phoebe eidolon" -stl' -> {terms:[eidolon, phoebe eidolon], exclude:[stl]}
export function parseQuery(q) {
  const terms = [];
  const exclude = [];
  const re = /(-?)"([^"]+)"|(-?)(\S+)/g;
  let m;
  while ((m = re.exec(q || ''))) {
    const neg = m[1] || m[3];
    const raw = (m[2] ?? m[4] ?? '').trim();
    if (!raw || (neg && !raw)) continue;
    const t = foldTerm(raw);
    if (t.length < 2 && !m[2]) continue; // ignore single letters
    (neg ? exclude : terms).push(t);
  }
  return { terms: [...new Set(terms)], exclude: [...new Set(exclude)] };
}

function findAll(haystack, needle) {
  const hits = [];
  if (!needle) return hits;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    hits.push(i);
    i = haystack.indexOf(needle, i + needle.length);
  }
  return hits;
}

// Pre-fold every update once; cheap to keep around between keystrokes.
export function prepare(updates) {
  return updates.map((u) => ({ u, title: fold(u.title || ''), body: fold(u.text || '') }));
}

/**
 * @param prepared  result of prepare()
 * @param query     raw query string
 * @param mode      'all' | 'any'
 * @returns {results, totalMentions, parsed}
 */
export function search(prepared, query, mode = 'all') {
  const parsed = parseQuery(query);
  const { terms, exclude } = parsed;
  if (!terms.length) return { results: [], totalMentions: 0, parsed };
  const results = [];
  let totalMentions = 0;
  for (const p of prepared) {
    if (exclude.some((t) => p.body.text.includes(t) || p.title.text.includes(t))) continue;
    const perTerm = terms.map((t) => ({
      t,
      title: findAll(p.title.text, t),
      body: findAll(p.body.text, t),
    }));
    const present = perTerm.filter((x) => x.title.length || x.body.length).length;
    if (mode === 'all' ? present < terms.length : present === 0) continue;
    // Body ranges in ORIGINAL text coordinates
    const ranges = [];
    const titleRanges = [];
    let mentions = 0;
    for (const x of perTerm) {
      mentions += x.title.length + x.body.length;
      for (const s of x.body) ranges.push(toOrig(p.body, s, x.t.length));
      for (const s of x.title) titleRanges.push(toOrig(p.title, s, x.t.length));
    }
    totalMentions += mentions;
    ranges.sort((a, b) => a[0] - b[0]);
    titleRanges.sort((a, b) => a[0] - b[0]);
    const score = mentions + (titleRanges.length ? 25 : 0) + present * 5;
    results.push({ update: p.u, mentions, ranges: mergeRanges(ranges), titleRanges: mergeRanges(titleRanges), score });
  }
  return { results, totalMentions, parsed };
}

function toOrig(folded, start, len) {
  const s = folded.map[start];
  const e = folded.map[start + len - 1] + 1;
  return [s, e];
}

function mergeRanges(r) {
  const out = [];
  for (const x of r) {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
    else out.push([x[0], x[1]]);
  }
  return out;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Wrap ranges of text in <mark>, escaping everything else.
export function highlight(text, ranges, from = 0, to = text.length) {
  let out = '';
  let pos = from;
  for (const [s, e] of ranges) {
    if (e <= from || s >= to) continue;
    const a = Math.max(s, from);
    const b = Math.min(e, to);
    out += escapeHtml(text.slice(pos, a)) + '<mark>' + escapeHtml(text.slice(a, b)) + '</mark>';
    pos = b;
  }
  return out + escapeHtml(text.slice(pos, to));
}

/**
 * Build snippet windows around matches. Windows stay inside one paragraph-ish block
 * and are merged when they overlap.
 */
export function snippets(text, ranges, radius = 110) {
  const wins = [];
  for (const [s, e] of ranges) {
    let a = Math.max(0, s - radius);
    let b = Math.min(text.length, e + radius);
    // don't cross paragraph breaks
    const pb = text.lastIndexOf('\n\n', s);
    if (pb >= a) a = pb + 2;
    const pe = text.indexOf('\n\n', e);
    if (pe !== -1 && pe < b) b = pe;
    // snap to word boundaries
    if (a > 0) {
      const sp = text.indexOf(' ', a);
      if (sp !== -1 && sp < s) a = sp + 1;
    }
    if (b < text.length) {
      const sp = text.lastIndexOf(' ', b);
      if (sp > e) b = sp;
    }
    const last = wins[wins.length - 1];
    if (last && a <= last.b + 20) last.b = Math.max(last.b, b);
    else wins.push({ a, b });
  }
  return wins.map(({ a, b }) => ({
    start: a,
    end: b,
    html:
      (a > 0 && text[a - 1] !== '\n' ? '…' : '') +
      highlight(text, ranges, a, b).replace(/\n+/g, ' ⏎ ') +
      (b < text.length && text[b] !== '\n' ? '…' : ''),
  }));
}
