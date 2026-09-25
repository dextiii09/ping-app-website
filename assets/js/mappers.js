// Row <-> app-shape mapping. The views/state were written against Firestore
// documents (camelCase, millisecond timestamps); Postgres rows are snake_case
// with timestamptz. Mapping here keeps every view untouched.
import { initialsAvatar, isPlaceholderAvatar } from './domUtils.js';

const ms = (t) => (t ? new Date(t).getTime() : 0);
const avatarOr = (src, name) => (isPlaceholderAvatar(src) ? initialsAvatar(name) : src);

export function profileFromRow(r, email) {
  if (!r) return null;
  const p = {
    id: r.id,
    name: r.name,
    role: r.role,
    avatar: avatarOr(r.avatar, r.name),
    bio: r.bio,
    location: r.location,
    tags: r.tags || [],
    company: r.company,
    jobTitle: r.job_title,
    industry: r.industry,
    companySize: r.company_size,
    website: r.website,
    socials: r.socials || {},
    socialStats: r.social_stats || {},
    stats: r.stats || {},
    settings: r.settings || {},
    status: r.status,
    verificationStatus: r.verification_status,
    verified: r.verified,
    reportCount: r.report_count,
    docUrl: r.doc_url,
    joinedAt: ms(r.joined_at)
  };
  if (email) p.email = email;
  return p;
}

const PROFILE_FIELD_MAP = {
  name: 'name', avatar: 'avatar', bio: 'bio', location: 'location', tags: 'tags',
  company: 'company', jobTitle: 'job_title', industry: 'industry', companySize: 'company_size',
  website: 'website', socials: 'socials', socialStats: 'social_stats', stats: 'stats',
  settings: 'settings', docUrl: 'doc_url', verificationStatus: 'verification_status'
};

export function profileFieldsToRow(fields) {
  const row = {};
  for (const [k, v] of Object.entries(fields)) {
    if (PROFILE_FIELD_MAP[k]) row[PROFILE_FIELD_MAP[k]] = v;
  }
  return row;
}

export function matchFromRow(r) {
  return {
    id: r.id,
    users: [r.user_a, r.user_b],
    lastMessage: r.last_message,
    lastSenderId: r.last_sender,
    lastActive: ms(r.last_active)
  };
}

export function messageFromRow(r) {
  const m = { id: r.id, senderId: r.sender_id, text: r.text, timestamp: ms(r.created_at), read: true, type: r.type };
  if (r.proposal_id) m.proposalId = r.proposal_id;
  return m;
}

export function proposalFromRow(r) {
  return {
    id: r.id, matchId: r.match_id, senderId: r.sender_id, receiverId: r.receiver_id,
    title: r.title, price: r.price, deadline: r.deadline, description: r.description,
    status: r.status, senderSignature: r.sender_signature, timestamp: ms(r.created_at)
  };
}

export function briefFromRow(r) {
  return {
    id: r.id, brandId: r.brand_id, brandName: r.brand_name, brandAvatar: avatarOr(r.brand_avatar, r.brand_name),
    title: r.title, description: r.description, budget: r.budget, location: r.location,
    deadline: ms(r.deadline), tags: r.tags || [], requirements: r.requirements || [],
    requiredVideos: r.required_videos, requiredStories: r.required_stories,
    applicationsCount: r.applications_count, status: r.status, timestamp: ms(r.created_at)
  };
}

export function briefToRow(b) {
  return {
    brand_id: b.brandId, brand_name: b.brandName || '', brand_avatar: b.brandAvatar || '',
    title: b.title, description: b.description || '', budget: b.budget || '',
    location: b.location || '', deadline: new Date(b.deadline).toISOString(),
    tags: b.tags || [], requirements: b.requirements || [],
    required_videos: b.requiredVideos ?? 1, required_stories: b.requiredStories ?? 2
  };
}

export function notificationFromRow(r) {
  return { id: r.id, type: r.type, title: r.title, text: r.text, read: r.read, timestamp: ms(r.created_at) };
}
