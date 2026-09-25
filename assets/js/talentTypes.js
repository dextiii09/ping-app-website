// Talent types for the campaign flow: influencers, comedians, DJs, bands and
// other artists. The list is meant to grow: to add a type, add an entry here
// and to the two *_talent_type_check constraints in
// supabase/campaign_matching.sql.
//
// `fields` are the type-specific profile details (profiles.talent_details).
// Influencers use their audience numbers (social_stats) instead. Fields with
// `url: true` are links; the rest are shown as highlights on applicant cards.
import { escapeHtml } from './domUtils.js';

export const TALENT_TYPES = [
  {
    id: 'INFLUENCER', label: 'Influencer', plural: 'influencers', icon: 'ph-camera',
    blurb: 'Reels, stories and posts',
    fields: []
  },
  {
    id: 'COMEDIAN', label: 'Comedian', plural: 'comedians', icon: 'ph-microphone-stage',
    blurb: 'Stand-up, hosting, sketches',
    fields: [
      { key: 'style', label: 'Style', placeholder: 'e.g. Observational, crowd work' },
      { key: 'shows', label: 'Shows performed', placeholder: 'e.g. 60+' },
      { key: 'showReel', label: 'Show reel', placeholder: 'YouTube / Instagram link', url: true }
    ]
  },
  {
    id: 'DJ', label: 'DJ', plural: 'DJs', icon: 'ph-vinyl-record',
    blurb: 'Club nights, parties, launches',
    fields: [
      { key: 'genres', label: 'Genres', placeholder: 'e.g. Bollywood, House' },
      { key: 'gigs', label: 'Gigs played', placeholder: 'e.g. 120' },
      { key: 'mixLink', label: 'Mix', placeholder: 'SoundCloud / Mixcloud / YouTube link', url: true }
    ]
  },
  {
    id: 'BAND', label: 'Band / Musician', plural: 'bands & musicians', icon: 'ph-guitar',
    blurb: 'Live sets, acoustic, covers',
    fields: [
      { key: 'genre', label: 'Genre', placeholder: 'e.g. Indie rock, Sufi' },
      { key: 'gigs', label: 'Gigs played', placeholder: 'e.g. 45' },
      { key: 'lineup', label: 'Line-up', placeholder: 'e.g. Solo, 3-piece' },
      { key: 'listenLink', label: 'Listen', placeholder: 'Spotify / YouTube link', url: true }
    ]
  },
  {
    id: 'ARTIST', label: 'Artist', plural: 'artists', icon: 'ph-paint-brush',
    blurb: 'Painters, dancers, magicians…',
    fields: [
      { key: 'discipline', label: 'What you do', placeholder: 'e.g. Live painting, dance' },
      { key: 'projects', label: 'Shows / projects', placeholder: 'e.g. 30' },
      { key: 'workLink', label: 'Work', placeholder: 'Instagram / Behance / YouTube link', url: true }
    ]
  }
];

const ANY = { id: 'ANY', label: 'Any talent', plural: 'all talent', icon: 'ph-users-three', blurb: 'Open to every talent type', fields: [] };

export function talentMeta(id) {
  if (id === 'ANY') return ANY;
  return TALENT_TYPES.find((t) => t.id === id) || TALENT_TYPES[0];
}

// A member's talent type (creators without one yet count as influencers).
export function talentTypeOf(user) {
  if (!user || user.role !== 'INFLUENCER') return null;
  return TALENT_TYPES.some((t) => t.id === user.talentType) ? user.talentType : 'INFLUENCER';
}

// Whether a brief made for `briefType` is open to this talent type.
export function briefFitsTalent(briefType, talentType) {
  return !briefType || briefType === 'ANY' || briefType === talentType;
}

// Only http(s) links ever reach an href; "instagram.com/x" gets https:// added.
export function safeUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch (e) {
    return '';
  }
}

const has = (v) => v !== undefined && v !== null && String(v).trim() !== '' && v !== '0' && v !== '0%';

// Up to three headline stats for an applicant card, per talent type.
export function talentHighlights(user) {
  const type = talentTypeOf(user) || 'INFLUENCER';
  if (type === 'INFLUENCER') {
    const s = user.socialStats || {};
    const demo = user.isDemo ? user.stats || {} : {};
    const out = [];
    const followers = has(s.instagramFollowers) ? s.instagramFollowers : demo.followers;
    if (has(followers)) out.push({ label: 'Instagram', value: followers });
    const eng = has(s.avgEngagement) ? s.avgEngagement : demo.engagement;
    if (has(eng)) out.push({ label: 'Engagement', value: eng });
    if (has(s.youtubeSubscribers)) out.push({ label: 'YouTube', value: s.youtubeSubscribers });
    return out.slice(0, 3);
  }
  const d = user.talentDetails || {};
  return talentMeta(type).fields.filter((f) => !f.url && has(d[f.key])).map((f) => ({ label: f.label, value: d[f.key] })).slice(0, 3);
}

// Links a brand can open: the type's link fields plus past work.
export function talentLinks(user) {
  const type = talentTypeOf(user) || 'INFLUENCER';
  const d = user.talentDetails || {};
  const out = talentMeta(type).fields.filter((f) => f.url && safeUrl(d[f.key])).map((f) => ({ label: f.label, url: safeUrl(d[f.key]) }));
  portfolioOf(user).forEach((p) => { if (!p.image) out.push(p); });
  return out;
}

// Past work, normalised. Demo profiles carry plain image URLs; real ones
// store [{label, url}].
export function portfolioOf(user) {
  return (Array.isArray(user?.portfolio) ? user.portfolio : []).map((p) => {
    if (typeof p === 'string') {
      const url = safeUrl(p);
      return url ? { label: 'Past work', url, image: /images\.unsplash\.com|\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) } : null;
    }
    const url = safeUrl(p?.url);
    return url ? { label: String(p.label || 'Past work').slice(0, 60), url, image: false } : null;
  }).filter(Boolean);
}

export function talentBadge(id, { withIcon = true } = {}) {
  const t = talentMeta(id);
  return `<span class="cm-type">${withIcon ? `<i class="ph-fill ${t.icon}"></i>` : ''}${escapeHtml(t.label)}</span>`;
}
