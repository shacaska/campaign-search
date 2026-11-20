// Node-side transports for each platform (used by GitHub Actions).
import { fetchKickstarterUpdates } from '../../assets/kickstarter-core.js';
import { fetchGamefoundUpdates } from '../../assets/gamefound-core.js';

export const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

function cookieHeader(res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

function blockedMessage(site, res, body) {
  const cf = /cloudflare|cf-ray|challenge-platform|Just a moment/i.test(body) || res.headers.get('cf-ray');
  return `${site} returned HTTP ${res.status}${cf ? ' (looks like a Cloudflare bot check)' : ''}`;
}

export async function kickstarterNode(ref, opts) {
  const page = await fetch(ref.url, { headers: BROWSER_HEADERS, redirect: 'follow' });
  const html = await page.text();
  if (!page.ok) {
    const e = new Error(blockedMessage('Kickstarter', page, html));
    e.fatal = true;
    throw e;
  }
  const csrf = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/)?.[1] ||
    html.match(/<meta[^>]+content="([^"]+)"[^>]+name="csrf-token"/)?.[1];
  const cookie = cookieHeader(page);
  const graph = async (body) => {
    const r = await fetch('https://www.kickstarter.com/graph', {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        accept: 'application/json',
        'content-type': 'application/json',
        origin: 'https://www.kickstarter.com',
        referer: ref.url + '/posts',
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    const t = await r.text();
    if (!r.ok) {
      const e = new Error(blockedMessage('Kickstarter /graph', r, t) + ': ' + t.slice(0, 200));
      e.fatal = r.status === 403 || r.status === 429;
      throw e;
    }
    return JSON.parse(t);
  };
  return fetchKickstarterUpdates(ref, graph, opts);
}

export async function gamefoundNode(ref, opts) {
  const http = async (url, init = {}) => {
    const r = await fetch(url, {
      ...init,
      headers: { ...BROWSER_HEADERS, ...(init.headers || {}) },
    });
    const t = await r.text();
    if (!r.ok) {
      const e = new Error(blockedMessage('Gamefound', r, t) + ` for ${url}`);
      e.status = r.status;
      throw e;
    }
    return t;
  };
  return fetchGamefoundUpdates(ref, http, opts);
}

export async function fetchCampaign(ref, opts = {}) {
  if (ref.platform === 'kickstarter') return kickstarterNode(ref, opts);
  if (ref.platform === 'gamefound') return gamefoundNode(ref, opts);
  throw new Error('Unsupported platform ' + ref.platform);
}
