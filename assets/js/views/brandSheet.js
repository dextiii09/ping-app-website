// Ping - a brand's profile as talent sees it, in a sheet over Discover and
// My applications: who they are, their website and their open campaigns.
import { store } from '../state.js';
import { escapeHtml } from '../domUtils.js';
import { campaignStatus } from '../campaignUtils.js';
import { brandProfileHtml } from './profileCards.js';

// The brand's profile, or what their campaign says about them.
export function brandFor(brandId, brief = null) {
  const u = store.users.find((x) => x.id === brandId && x.role === 'BUSINESS');
  if (u) return u;
  const b = brief || store.briefs.find((x) => x.brandId === brandId);
  return b ? { id: brandId, role: 'BUSINESS', company: b.brandName, name: b.brandName, avatar: b.brandAvatar } : null;
}

// `actionFor(campaign)` draws the button or status for each open campaign.
export function brandSheetHtml(brandId, { brief = null, actionFor = null } = {}) {
  const brand = brandFor(brandId, brief);
  if (!brand) return '';
  const open = store.briefs
    .filter((b) => b.brandId === brandId && campaignStatus(b) === 'OPEN')
    .sort((x, y) => (y.timestamp || 0) - (x.timestamp || 0));
  return `
    <div class="platform-modal-backdrop active cm-overlay">
      <div class="platform-modal-window bp-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(brand.company || brand.name)}">
        <button class="platform-modal-close" data-close aria-label="Close">&times;</button>
        ${brandProfileHtml(brand, { campaigns: open, applyButton: actionFor })}
      </div>
    </div>`;
}
