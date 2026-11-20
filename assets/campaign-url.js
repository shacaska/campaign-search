// Shared by the site, the bookmarklet and the Node fetchers.
// Turns any Kickstarter / Gamefound campaign link into a canonical campaign reference.

const SLUG = /^[a-z0-9][a-z0-9_.-]{0,160}$/i;

export function parseCampaignUrl(input) {
  if (!input) return null;
  let s = String(input).trim();
  // Accept bare "kickstarter.com/projects/..." too
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (host === 'kickstarter.com') {
    if (parts[0] !== 'projects' || parts.length < 3) return null;
    const creator = parts[1].toLowerCase();
    const slug = parts[2].toLowerCase();
    if (!SLUG.test(creator) || !SLUG.test(slug)) return null;
    return {
      platform: 'kickstarter',
      creator,
      slug,
      id: `kickstarter/${creator}/${slug}`,
      url: `https://www.kickstarter.com/projects/${creator}/${slug}`,
    };
  }

  if (host === 'gamefound.com') {
    // /en/projects/creator/slug/...  or  /projects/creator/slug/...
    let i = parts.indexOf('projects');
    if (i < 0 || i > 1 || parts.length < i + 3) return null;
    const creator = parts[i + 1].toLowerCase();
    const slug = parts[i + 2].toLowerCase();
    if (!SLUG.test(creator) || !SLUG.test(slug)) return null;
    return {
      platform: 'gamefound',
      creator,
      slug,
      id: `gamefound/${creator}/${slug}`,
      url: `https://gamefound.com/en/projects/${creator}/${slug}`,
    };
  }
  return null;
}

export function campaignDataPath(id) {
  return `campaigns/${id}.json`;
}

export const PLATFORM_NAMES = { kickstarter: 'Kickstarter', gamefound: 'Gamefound' };
