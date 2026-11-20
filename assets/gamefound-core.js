// Gamefound update fetching, run in the user's browser on gamefound.com.
// 1. The updates list comes from the same API the Updates tab uses (POST /api/projectUpdates/searchProjectUpdates).
// 2. Each update's full text is embedded in its own page as JSON ("update":{..."content":"<html>"}),
//    so we fetch those pages one by one (same-origin, with the user's session, so backer-only text works too).

import { htmlToText } from './text.js';

export function findProjectId(html) {
  const m =
    html.match(/contact\?projectID=(\d+)/) ||
    html.match(/"projectUserContext":\{[^}]*"projectID":(\d+)/) ||
    html.match(/"projectID":(\d+)/);
  return m ? Number(m[1]) : null;
}

// Pull "content":"..." out of the embedded "update":{...} object.
export function extractUpdateContent(html) {
  const at = html.indexOf('"update":{');
  if (at === -1) return null;
  const rest = html.slice(at, at + 3_000_000);
  const m = rest.match(/"content":("(?:[^"\\]|\\.)*"|null)/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/**
 * @param ref   parsed campaign
 * @param http  async (url, init?) => response text
 * @param opts  {onProgress?, delayMs?, known?: Map(url -> previously fetched update)}
 */
export async function fetchGamefoundUpdates(ref, http, opts = {}) {
  const { onProgress = () => {}, delayMs = 200, known = new Map() } = opts;
  const base = ref.url; // https://gamefound.com/en/projects/creator/slug
  const listHtml = await http(base + '/updates');
  const projectID = findProjectId(listHtml);
  if (!projectID) throw new Error('Couldn’t find the Gamefound project ID on the updates page');
  const name =
    (listHtml.match(/<title>([^<]*)<\/title>/)?.[1] || '')
      .replace(/\s*-\s*Updates\s*-\s*Gamefound\s*$/i, '')
      .replace(/\s*-\s*Gamefound\s*$/i, '')
      .trim() || ref.slug;

  // Page through the list (newest first; each page continues below the lowest sequence number seen).
  const items = new Map();
  let lowest = null;
  for (let page = 0; page < 100; page++) {
    const txt = await http('https://gamefound.com/api/projectUpdates/searchProjectUpdates', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        projectID,
        lowestFetchedSequenceNumber: lowest,
        searchTerm: '',
        dateFrom: null,
        dateTo: null,
        onlyUserRelevant: false,
        projectUpdateUserContext: 1,
      }),
    });
    const data = JSON.parse(txt);
    const batch = data.pagedItems || data.items || [];
    let added = 0;
    for (const it of batch) {
      if (!items.has(it.projectUpdateID)) { items.set(it.projectUpdateID, it); added++; }
    }
    const seqs = batch.map((b) => b.sequenceNumber).filter((n) => typeof n === 'number');
    if (!added || !seqs.length) break;
    const min = Math.min(...seqs);
    if (lowest !== null && min >= lowest) break;
    lowest = min;
    if (min <= 1 || data.hasMoreItems === false) break;
  }

  const list = [...items.values()].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));
  const updates = [];
  let done = 0;
  for (const it of list) {
    const url = new URL(it.projectUpdateUrl || `${base}/updates/${it.sequenceNumber}`, 'https://gamefound.com').href;
    const prev = known.get(url);
    const date = it.publishedAt || it.createdAt || null;
    if (prev && prev.text && prev.date === date) {
      updates.push(prev); // unchanged since last time
    } else {
      let content = null;
      try {
        content = extractUpdateContent(await http(url));
      } catch (e) {
        if (e.status !== 403 && e.status !== 404) throw e;
      }
      updates.push({
        id: String(it.projectUpdateID),
        n: it.sequenceNumber ?? null,
        title: (it.title || '').trim(),
        date,
        url,
        public: it.targetAudience === 0 || it.targetAudience == null,
        locked: !content,
        text: content ? htmlToText(content) : (it.abstract || ''),
      });
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    }
    onProgress(++done, list.length);
  }
  return { name, url: base, updates };
}
