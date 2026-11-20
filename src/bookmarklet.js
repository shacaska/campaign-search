import { openOverlay } from '../assets/overlay.js';
try {
  openOverlay();
} catch (e) {
  console.error('[campaign-search]', e);
  alert('Campaign Search couldn’t open here: ' + (e && e.message ? e.message : e));
}
