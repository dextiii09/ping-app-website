// Ping - media kit helpers shared by the Media Kit editor, the brand's
// applicant list and the public media-kit page: audience numbers (with honest
// "self-reported" labels), social links and the profile checklist.
import { talentTypeOf, talentMeta, portfolioOf, safeUrl } from './talentTypes.js';
import { isPlaceholderAvatar } from './domUtils.js';
import { NICHE_TAGS } from './mockData.js';

const has = (v) => v !== undefined && v !== null && String(v).trim() !== '' && v !== '0' && v !== '0%';

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

// "@simran.eats", "simran.eats" or an instagram.com link -> the profile URL.
export function instagramUrl(handle) {
  const h = String(handle || '').trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? `https://instagram.com/${h}` : '';
}

// A channel link, or "@handle" / "handle" -> youtube.com/@handle.
export function youtubeUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v) || /(youtube\.com|youtu\.be)/i.test(v)) return safeUrl(v);
  const h = v.replace(/^@/, '');
  return /^[A-Za-z0-9._-]{1,60}$/.test(h) ? `https://youtube.com/@${h}` : '';
}

// Audience numbers the member reported, in the order brands care about.
// Demo profiles keep their seeded numbers.
export function audienceOf(user) {
  const s = user.socialStats || {};
  const demo = user.isDemo ? user.stats || {} : {};
  const ig = instagramUrl(user.socials?.instagram);
  const yt = youtubeUrl(user.socials?.youtube);
  const out = [];
  const followers = has(s.instagramFollowers) ? s.instagramFollowers : demo.followers;
  if (has(followers)) out.push({ key: 'ig', label: 'Instagram followers', short: 'Instagram', value: followers, icon: 'ph-instagram-logo', href: ig });
  if (has(s.avgReelViews)) out.push({ key: 'reels', label: 'Avg Reel views', short: 'Reel views', value: s.avgReelViews, icon: 'ph-play-circle', href: ig });
  const eng = has(s.avgEngagement) ? s.avgEngagement : demo.engagement;
  if (has(eng)) out.push({ key: 'eng', label: 'Avg engagement', short: 'Engagement', value: eng, icon: 'ph-chart-line-up' });
  if (has(s.youtubeSubscribers)) out.push({ key: 'yt', label: 'YouTube subscribers', short: 'YouTube', value: s.youtubeSubscribers, icon: 'ph-youtube-logo', href: yt });
  return out;
}

export function updatedAgo(ms) {
  if (!ms) return '';
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

// "Self-reported · updated 3 days ago"
export function statsNote(user) {
  const at = user.socialStats?.updatedAt;
  return `Self-reported${at ? ` · updated ${updatedAgo(at)}` : ''}`;
}

// What makes a media kit (or a brand profile) complete. Each item names the
// element it jumps to in the editor.
export function completeness(user) {
  const creator = user.role === 'INFLUENCER';
  const bioOk = String(user.bio || '').trim().length >= 60;
  const items = [];
  const add = (key, label, done, target) => items.push({ key, label, done: !!done, target });

  if (creator) {
    const type = talentTypeOf(user);
    const meta = talentMeta(type);
    const details = user.talentDetails || {};
    const s = user.socialStats || {};
    const rates = user.settings?.rateCard || {};
    add('photo', 'Add a profile photo', !isPlaceholderAvatar(user.avatar), 'mkIdentity');
    add('bio', 'Write a short bio', bioOk, 'inputProfBio');
    add('location', 'Add your location', String(user.location || '').trim(), 'inputProfLocation');
    add('niches', 'Pick your niches', (user.tags || []).some((t) => NICHE_TAGS.includes(t)), 'mkNiches');
    if (type === 'INFLUENCER') {
      add('handle', 'Add your Instagram handle', instagramUrl(user.socials?.instagram) || youtubeUrl(user.socials?.youtube), 'inputSocialInstagram');
      add('audience', 'Add your audience numbers', has(s.instagramFollowers) || has(s.youtubeSubscribers), 'inputStatIg');
      add('rates', 'Add your rates', Object.values(rates).some((v) => String(v || '').trim()), 'inputRateReel');
    } else {
      add('details', `Fill in your ${meta.label.toLowerCase()} details`, meta.fields.every((f) => String(details[f.key] || '').trim()), 'mkTalentFields');
    }
    add('work', 'Show your past work', portfolioOf(user).length > 0, 'mkWork');
    add('public', 'Turn on your public link', user.publicKit && user.handle, 'mkPublic');
    add('verified', 'Get verified', user.verified || user.verificationStatus === 'PENDING', 'mkVerify');
  } else {
    add('logo', 'Add your logo', !isPlaceholderAvatar(user.avatar), 'mkIdentity');
    add('company', 'Add your business name', String(user.company || '').trim(), 'inputProfCompany');
    add('about', 'Say what your business is about', bioOk, 'inputProfBio');
    add('location', 'Add your location', String(user.location || '').trim(), 'inputProfLocation');
    add('industry', 'Choose your industry', String(user.industry || '').trim(), 'inputBizIndustry');
    add('website', 'Add your website or Instagram', safeUrl(user.website), 'inputBizWebsite');
    add('verified', 'Get verified', user.verified || user.verificationStatus === 'PENDING', 'mkVerify');
  }
  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}
