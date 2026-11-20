// Temporary diagnostics: run on GitHub Actions to see what Kickstarter/Gamefound return
// to a server, and write everything to probe-out/ so it can be inspected.
import { mkdir, writeFile } from 'node:fs/promises';
import { BROWSER_HEADERS } from './lib/platforms.mjs';

const OUT = 'probe-out';
await mkdir(OUT, { recursive: true });
const log = [];
const note = (...a) => { const s = a.join(' '); console.log(s); log.push(s); };

async function grab(name, url, init = {}) {
  try {
    const r = await fetch(url, { ...init, headers: { ...BROWSER_HEADERS, ...(init.headers || {}) } });
    const t = await r.text();
    note(`${name}: HTTP ${r.status} ${r.headers.get('content-type')} len=${t.length} server=${r.headers.get('server')}`);
    await writeFile(`${OUT}/${name}.txt`, `HTTP ${r.status}\n${[...r.headers].map(([k, v]) => k + ': ' + v).join('\n')}\n\n${t}`);
    return { r, t };
  } catch (e) {
    note(`${name}: ERROR ${e.message}`);
    return {};
  }
}

const targets = (process.env.PROBE_URLS || '').split(/\s+/).filter(Boolean);
let i = 0;
for (const u of targets) await grab(`page-${i++}`, u);

// Kickstarter GraphQL with session from project page
const ks = targets.find((u) => u.includes('kickstarter.com'));
if (ks) {
  const { r, t } = await grab('ks-project', ks);
  if (r) {
    const csrf = t.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/)?.[1];
    const cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
    note('ks csrf found:', !!csrf, 'cookies:', cookie.split(';').map((c) => c.split('=')[0].trim()).join(','));
    const slug = new URL(ks).pathname.split('/')[3];
    for (const s of [slug]) {
      await grab('ks-graph', 'https://www.kickstarter.com/graph', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json', 'x-csrf-token': csrf || '', cookie, origin: 'https://www.kickstarter.com', referer: ks },
        body: JSON.stringify({
          query: `query($slug:String!){project(slug:$slug){id name url posts(first:3){totalCount pageInfo{hasNextPage endCursor} nodes{__typename id title number publishedAt isPublic isVisible ... on FreeformPost{body}}}}}`,
          variables: { slug: s },
        }),
      });
    }
  }
}

await writeFile(`${OUT}/summary.txt`, log.join('\n') + '\n');
