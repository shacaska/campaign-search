import { openOverlay } from '../assets/overlay.js';
import { parseCampaignUrl } from '../assets/campaign-url.js';

// Adds a floating "Search updates" button on campaign pages (handles in-site navigation too).
function ensureButton() {
  const onCampaign = !!parseCampaignUrl(location.href);
  let btn = document.getElementById('campaign-search-fab');
  if (!onCampaign) { btn?.remove(); return; }
  if (btn) return;
  btn = document.createElement('button');
  btn.id = 'campaign-search-fab';
  btn.textContent = '🔎 Search updates';
  btn.setAttribute('style', 'position:fixed;z-index:2147483645;right:16px;bottom:16px;padding:10px 16px;border:0;border-radius:999px;background:#9a5b1e;color:#fff;font:600 14px/1 -apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25);cursor:pointer');
  btn.addEventListener('click', openOverlay);
  document.body.appendChild(btn);
}
ensureButton();
let last = location.href;
setInterval(() => { if (location.href !== last) { last = location.href; ensureButton(); } }, 1000);
