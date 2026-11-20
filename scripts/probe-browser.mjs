// Diagnostics: drive real Chrome (headed under xvfb) to see whether Cloudflare's challenge
// clears on a GitHub runner, and record the API calls Gamefound's updates page makes.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const OUT = 'probe-out';
await mkdir(OUT, { recursive: true });
const log = [];
const note = (...a) => { const s = a.join(' '); console.log(s); log.push(s); };

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));

async function passChallenge(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 40; i++) {
    const t = await page.title().catch(() => '');
    if (t && !/just a moment|attention required/i.test(t)) { note(`  cleared after ~${i * 1.5}s, title="${t}"`); return true; }
    await page.waitForTimeout(1500);
  }
  note('  STILL CHALLENGED, title=', await page.title());
  await page.screenshot({ path: `${OUT}/challenge-${Date.now()}.png` });
  return false;
}

// ---- Kickstarter
try {
  const ks = 'https://www.kickstarter.com/projects/kingdomsforlorn/aeon-trespass-odyssey-second-printing';
  const page = await ctx.newPage();
  note('KS:');
  if (await passChallenge(page, ks)) {
    const res = await page.evaluate(async () => {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
      const r = await fetch('/graph', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': csrf || '' },
        body: JSON.stringify({
          query: `query($slug:String!){project(slug:$slug){id name url posts(first:3){totalCount pageInfo{hasNextPage endCursor} nodes{__typename id title number publishedAt isPublic isVisible ... on FreeformPost{body}}}}}`,
          variables: { slug: 'aeon-trespass-odyssey-second-printing' },
        }),
      });
      return { status: r.status, csrf: !!csrf, body: (await r.text()).slice(0, 20000) };
    });
    note(`  graph status=${res.status} csrf=${res.csrf}`);
    await writeFile(`${OUT}/ks-graph.json`, res.body);
  }
  await page.close();
} catch (e) { note('KS error', e.message); }

// ---- Gamefound
try {
  const gf = 'https://gamefound.com/en/projects/earthborne-games/hubworld-aidalon/updates';
  const page = await ctx.newPage();
  const calls = [];
  page.on('response', async (r) => {
    const req = r.request();
    const type = req.resourceType();
    if (!['xhr', 'fetch', 'document'].includes(type)) return;
    let body = '';
    try { body = (await r.text()).slice(0, 4000); } catch {}
    calls.push({ type, method: req.method(), url: r.url(), status: r.status(), post: req.postData()?.slice(0, 1000), body });
  });
  note('GF:');
  if (await passChallenge(page, gf)) {
    await page.waitForTimeout(6000);
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(3000);
    await writeFile(`${OUT}/gf-updates.html`, await page.content());
    const links = await page.$$eval('a[href*="/updates/"]', (as) => [...new Set(as.map((a) => a.href))].slice(0, 50));
    note('  update links:', links.length, links.slice(0, 5).join(' '));
    if (links[0]) {
      await page.goto(links[0], { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
      await writeFile(`${OUT}/gf-update-1.html`, await page.content());
    }
  }
  await writeFile(`${OUT}/gf-calls.json`, JSON.stringify(calls, null, 1));
  note('  calls recorded:', calls.length);
} catch (e) { note('GF error', e.message); }

await browser.close();
await writeFile(`${OUT}/summary.txt`, log.join('\n') + '\n');
