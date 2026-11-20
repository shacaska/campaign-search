// Kickstarter update fetching via Kickstarter's own GraphQL endpoint (/graph).
// Transport is injected so the same code runs in Node (GitHub Actions) and in the
// bookmarklet (same-origin fetch with the user's session, which also unlocks backer-only posts).

import { htmlToText } from './text.js';

// Tried in order; later variants drop fields in case Kickstarter changes its schema.
const POST_FIELDS = [
  `__typename id title number publishedAt isPublic isVisible ... on FreeformPost { body }`,
  `__typename id title publishedAt isPublic ... on FreeformPost { body }`,
  `__typename id title publishedAt ... on FreeformPost { body }`,
];

const query = (fields) => `query CampaignPosts($slug: String!, $cursor: String) {
  project(slug: $slug) {
    id name url
    posts(first: 25, after: $cursor) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { ${fields} }
    }
  }
}`;

function b64decode(s) {
  if (typeof atob === 'function') return atob(s);
  return Buffer.from(s, 'base64').toString('utf8');
}

export function postNumericId(gid) {
  try {
    const m = b64decode(gid).match(/-(\d+)$/);
    if (m) return m[1];
  } catch {}
  return /^\d+$/.test(String(gid)) ? String(gid) : null;
}

function toIso(v) {
  if (v == null) return null;
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  if (/^\d+$/.test(v)) return toIso(Number(v));
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}

/**
 * @param ref   parsed campaign ({creator, slug, url})
 * @param graph async (body:{query,variables}) => parsed JSON response
 * @param opts  {onProgress?, delayMs?, maxPosts?}
 */
export async function fetchKickstarterUpdates(ref, graph, opts = {}) {
  const { onProgress = () => {}, delayMs = 250, maxPosts = 2000 } = opts;
  const slugCandidates = [ref.slug, `${ref.creator}/${ref.slug}`];
  let lastErr;
  for (const fields of POST_FIELDS) {
    for (const slug of slugCandidates) {
      try {
        return await fetchAll(ref, graph, query(fields), slug, { onProgress, delayMs, maxPosts });
      } catch (e) {
        lastErr = e;
        if (e.fatal) throw e;
        if (e.graphql) break; // schema problem: the other slug form won't help, try fewer fields
      }
    }
  }
  throw lastErr;
}

async function fetchAll(ref, graph, q, slug, { onProgress, delayMs, maxPosts }) {
  const nodes = [];
  let cursor = null;
  let project = null;
  let total = null;
  for (let page = 0; page < 200; page++) {
    const res = await graph({ query: q, variables: { slug, cursor } });
    if (res?.errors?.length) {
      const err = new Error('Kickstarter GraphQL error: ' + res.errors.map((e) => e.message).join('; '));
      err.graphql = res.errors;
      throw err;
    }
    const p = res?.data?.project;
    if (!p) throw new Error(`Kickstarter has no project for slug "${slug}"`);
    project = p;
    total = p.posts?.totalCount ?? total;
    nodes.push(...(p.posts?.nodes || []).filter(Boolean));
    onProgress(nodes.length, total);
    const info = p.posts?.pageInfo;
    if (!info?.hasNextPage || nodes.length >= maxPosts) break;
    cursor = info.endCursor;
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }
  const base = (project.url || ref.url).replace(/\/$/, '');
  const updates = nodes.map((n) => {
    const pid = postNumericId(n.id);
    const hasBody = typeof n.body === 'string' && n.body.length > 0;
    return {
      id: pid || n.id,
      n: n.number ?? null,
      title: (n.title || '').trim(),
      date: toIso(n.publishedAt),
      url: pid ? `${base}/posts/${pid}` : `${base}/posts`,
      public: n.isPublic !== false,
      locked: !hasBody && n.__typename === 'FreeformPost',
      text: hasBody ? htmlToText(n.body) : '',
      kind: n.__typename === 'FreeformPost' ? undefined : n.__typename,
    };
  });
  // Oldest first; number posts if Kickstarter didn't give us numbers
  updates.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (updates.every((u) => u.n == null)) updates.forEach((u, i) => (u.n = i + 1));
  return { name: project.name, url: base, updates };
}
