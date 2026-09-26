// Ping Web Platform - State Store & Persistence Layer
import { SEED_USERS, SEED_BRIEFS, SEED_MATCHES, SEED_APPLICATIONS } from './mockData.js';
import { briefWindow, windowsOverlap, formatWindow, formatINR, dateOnlyMs, campaignStatus, sameCity, selectedNote } from './campaignUtils.js';
import { talentTypeOf, briefFitsTalent } from './talentTypes.js';

const STORAGE_KEY = 'ping_platform_state_v1';
// Bumped when the cached shape changes (v2: campaign matching flow), so an
// older cache is ignored instead of mixing old and new seed data.
const STATE_VERSION = 2;
const clone = (v) => JSON.parse(JSON.stringify(v));

class StateStore {
  constructor() {
    this.listeners = new Set();
    this.load();
  }

  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.version === STATE_VERSION) {
          this.currentUser = parsed.currentUser || clone(SEED_USERS[0]);
          this.users = parsed.users || clone(SEED_USERS);
          this.briefs = parsed.briefs || clone(SEED_BRIEFS);
          this.matches = parsed.matches || clone(SEED_MATCHES);
          this.applications = parsed.applications || clone(SEED_APPLICATIONS);
          this.broadcasts = parsed.broadcasts || [];
          this.notifications = []; // live-only, populated by loadNotifications() for real accounts
          return;
        }
      } catch (e) {
        console.warn('Failed to parse cached state, restoring seeds', e);
      }
    }

    // Default fresh seed (deep copies, so demo changes never touch mockData)
    this.currentUser = clone(SEED_USERS[0]);
    this.users = clone(SEED_USERS);
    this.briefs = clone(SEED_BRIEFS);
    this.matches = clone(SEED_MATCHES);
    this.applications = clone(SEED_APPLICATIONS);
    this.notifications = [];
    this.broadcasts = [
      {
        id: "bcast_1",
        title: "Welcome to Ping Platform",
        body: "Connecting local businesses with local creators, wherever you are — now live in early access.",
        timestamp: Date.now() - 1000 * 60 * 60 * 12
      }
    ];
    this.save();
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STATE_VERSION,
        currentUser: this.currentUser,
        users: this.users,
        briefs: this.briefs,
        matches: this.matches,
        applications: this.applications,
        broadcasts: this.broadcasts
      }));
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }

  resetAll() {
    localStorage.removeItem(STORAGE_KEY);
    this.load();
    this.notify();
  }

  // Real accounts (Supabase Auth + their `profiles` row)
  hydrateRealUser(profile) {
    this.currentUser = profile;
    // Strip any previously-loaded real (non-seed) candidate profiles before
    // rehydrating. this.users can carry real candidates forward from a PRIOR
    // hydration in two ways realCandidateIds can't track: (1) a full page
    // reload, since localStorage persists `users` but realCandidateIds is a
    // Set (not JSON-serializable, never saved) and starts fresh every load;
    // (2) a prior login/persona switch earlier in the same tab. Mock/seed
    // users are always tagged isDemo: true (see mockData.js), so anything
    // without that tag, other than the profile being hydrated, is a stale
    // real candidate left over from before - keep only seeds + self here,
    // then let the fresh subscription below repopulate real candidates
    // correctly.
    this.users = this.users.filter(u => u.isDemo || u.id === profile.id);
    const idx = this.users.findIndex(u => u.id === profile.id);
    if (idx === -1) {
      this.users.unshift(profile);
    } else {
      this.users[idx] = profile;
    }
    this.isRealAccount = true;
    this.realCandidateIds = new Set();
    this.blockedUserIds = new Set();
    this.applications = [];
    this.save();
    this.loadRealBriefs();
    this.loadRealMatches();
    this.loadRealDiscoveryCandidates();
    this.loadBlockedUsers();
    this.loadNotifications();
    this.loadApplications();
  }

  // Campaign applications this account can see: a talent's own, or every
  // application to a brand's campaigns (RLS scopes the query). Live, so a
  // brand sees new applicants and a talent sees decisions as they happen.
  async loadApplications() {
    if (!['BUSINESS', 'INFLUENCER'].includes(this.currentUser.role)) return;
    try {
      const { subscribeToApplications } = await import('./briefsService.js');
      if (this.unsubscribeApplications) this.unsubscribeApplications();
      this.unsubscribeApplications = subscribeToApplications((apps) => {
        this.applications = apps;
        this.notify();
      });
    } catch (err) {
      console.error('Failed to load applications:', err);
    }
  }

  // Live-subscribes to OTHER real users' discoverable profiles
  // (public_profiles collection - see discoveryService.js for why this is
  // separate from users/{uid}) and merges them into the local candidate
  // member list alongside the demo profiles (applicant cards, chat partners).
  // Also what makes the admin verification queue update live, since
  // opsPlatform.js reads store.users directly.
  async loadRealDiscoveryCandidates() {
    try {
      const { subscribeToDiscoverableProfiles } = await import('./discoveryService.js');
      if (this.unsubscribeDiscoveryCandidates) this.unsubscribeDiscoveryCandidates();
      this.unsubscribeDiscoveryCandidates = subscribeToDiscoverableProfiles(this.currentUser.id, (profiles) => {
        // Drop whatever real profiles the previous snapshot added, then add
        // the current set - keeps mock seed users and "self" untouched, and
        // correctly reflects removals/role changes, not just upserts.
        this.users = this.users.filter(u => !this.realCandidateIds.has(u.id));
        this.realCandidateIds = new Set(profiles.map(p => p.id));
        this.users.push(...profiles);
        this.notify();
      });
    } catch (err) {
      console.error('Failed to subscribe to discoverable profiles:', err);
    }
  }

  // Replaces the mock-seeded matches list with a LIVE subscription to the
  // `matches` the current user is part of - a new
  // match, or a lastMessage/lastActive change on an existing one, updates
  // the list automatically. Messages are NOT included here - they're
  // subscribed to lazily per-match via loadMessagesForMatch when a
  // conversation is actually opened.
  async loadRealMatches() {
    try {
      const { subscribeToMatches } = await import('./matchService.js');
      if (this.unsubscribeMatches) this.unsubscribeMatches();
      this.unsubscribeMatches = subscribeToMatches(this.currentUser.id, (realMatches) => {
        // Preserve any already-subscribed messages on matches that still exist.
        this.matches = realMatches.map(m => {
          const existing = this.matches.find(em => em.id === m.id);
          return { ...m, messages: existing?.messages || [] };
        });
        this.notify();
      });
    } catch (err) {
      console.error('Failed to subscribe to matches:', err);
    }
  }

  // Live-subscribes to this account's real notifications (see
  // notificationService.js) - written by the OTHER side's client when a
  // match happens or a message arrives, not derived/recomputed locally like
  // the old fake activity-bell count was.
  async loadNotifications() {
    try {
      const { subscribeToNotifications } = await import('./notificationService.js');
      if (this.unsubscribeNotifications) this.unsubscribeNotifications();
      this.unsubscribeNotifications = subscribeToNotifications(this.currentUser.id, (notifications) => {
        this.notifications = notifications;
        this.notify();
      });
    } catch (err) {
      console.error('Failed to subscribe to notifications:', err);
    }
  }

  async markNotificationsRead() {
    if (!this.isRealAccount || !this.notifications?.length) return;
    try {
      const { markAllNotificationsRead } = await import('./notificationService.js');
      await markAllNotificationsRead(this.currentUser.id, this.notifications);
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  }

  // Lazily subscribes to (and resolves any proposal references in) the
  // messages for one match, so new messages from either side appear live
  // without a manual refresh. Real-schema messages only carry a `proposalId`
  // pointer, not the full proposal - subscribeToMessages resolves that
  // reference and attaches it as `proposalData` so the existing rendering
  // code keeps working. Only one match's messages are subscribed to at a
  // time (switching matches tears down the previous subscription).
  loadMessagesForMatch(matchId) {
    const match = this.matches.find(m => m.id === matchId);
    if (!match || !this.isRealAccount) return;
    if (this.subscribedMessagesMatchId === matchId) return;

    import('./matchService.js').then(({ subscribeToMessages }) => {
      if (this.unsubscribeMessages) this.unsubscribeMessages();
      this.subscribedMessagesMatchId = matchId;
      this.unsubscribeMessages = subscribeToMessages(matchId, (messages) => {
        const m = this.matches.find(mm => mm.id === matchId);
        if (m) m.messages = messages;
        this.notify();
      });
    }).catch(err => {
      console.error('Failed to subscribe to messages for match:', err);
    });
  }

  // Creates a Smart Proposal: title, price, deadline and description. The
  // person it's sent to accepts or declines it (respondToProposal).
  async createProposal(matchId, receiverId, proposalFields) {
    if (this.isRealAccount) {
      const { createProposalRemote } = await import('./matchService.js');
      const { id } = await createProposalRemote(matchId, this.currentUser.id, receiverId, proposalFields);
      const proposalData = { id, ...proposalFields, status: 'PENDING' };
      return this.sendMessage(matchId, `Smart Proposal Created: ${proposalFields.title}`, 'proposal', proposalData);
    }

    const proposalData = {
      id: `prop_${Date.now()}`,
      ...proposalFields,
      status: 'PENDING'
    };
    return this.sendMessage(matchId, `Smart Proposal Created: ${proposalFields.title}`, 'proposal', proposalData);
  }

  // Trust & safety: loads who the current real account has blocked.
  // Blocking is local to the
  // blocker (see discoveryService.blockUser) - it doesn't touch the other
  // user's view of anything.
  async loadBlockedUsers() {
    try {
      const { fetchBlockedUsers } = await import('./discoveryService.js');
      const blocked = await fetchBlockedUsers(this.currentUser.id);
      this.blockedUserIds = new Set(blocked.map(b => b.id));
      this.notify();
    } catch (err) {
      console.error('Failed to load blocked users:', err);
    }
  }

  async blockUserAndLeaveMatch(blockedUserId, matchId = null) {
    const { blockUser } = await import('./discoveryService.js');
    await blockUser(this.currentUser.id, blockedUserId, matchId);
    this.blockedUserIds.add(blockedUserId);
    this.notify();
  }

  async unblockUser(blockedUserId) {
    const { unblockUser } = await import('./discoveryService.js');
    await unblockUser(this.currentUser.id, blockedUserId);
    this.blockedUserIds.delete(blockedUserId);
    this.notify();
  }

  getBlockedUsers() {
    if (!this.blockedUserIds) return [];
    return this.users.filter(u => this.blockedUserIds.has(u.id));
  }

  // Replaces the mock-seeded briefs list with a LIVE subscription to the
  // real live_briefs table (new briefs and pitch counts arrive without a
  // refresh). Leaves the mock briefs in place if the subscription fails.
  async loadRealBriefs() {
    try {
      const { subscribeToLiveBriefs } = await import('./briefsService.js');
      if (this.unsubscribeBriefs) this.unsubscribeBriefs();
      this.unsubscribeBriefs = subscribeToLiveBriefs((briefs) => {
        this.briefs = briefs;
        this.notify();
      });
    } catch (err) {
      console.error('Failed to load live briefs:', err);
    }
  }

  // Stops the per-match message subscription (call when leaving Deal Room
  // entirely, not when switching between conversations within it).
  stopMessageSubscription() {
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
      this.unsubscribeMessages = null;
    }
    this.subscribedMessagesMatchId = null;
  }

  // Auth & Role switching
  setCurrentUser(userId) {
    const target = this.users.find(u => u.id === userId);
    if (target) {
      this.currentUser = target;
      this.save();
    }
  }

  // Updates the screen straight away, then saves. If the save fails the local
  // copy is rolled back and the error is rethrown, so callers can tell the
  // user instead of showing "saved" for changes that are lost on reload.
  async updateCurrentUserProfile(fields) {
    const previous = this.currentUser;
    this.currentUser = { ...this.currentUser, ...fields };
    this.users = this.users.map(u => u.id === this.currentUser.id ? this.currentUser : u);
    this.save();

    if (!this.isRealAccount) return;
    try {
      const { updateUserProfile } = await import('./authService.js');
      await updateUserProfile(previous.id, fields);
    } catch (err) {
      this.currentUser = previous;
      this.users = this.users.map(u => u.id === previous.id ? previous : u);
      this.save();
      throw err;
    }
  }

  // Campaign briefs (spec: title, description, deliverables, a fixed fee per
  // talent, slots, talent type, niche + location, deadline / event date).
  async createBrief(data) {
    const endsOn = dateOnlyMs(data.endsOn);
    const deadline = new Date(endsOn);
    deadline.setHours(23, 59, 59, 0);
    const newBrief = {
      brandId: this.currentUser.id,
      brandName: this.currentUser.company || this.currentUser.name,
      brandAvatar: this.currentUser.avatar,
      title: data.title,
      description: data.description,
      deliverables: data.deliverables,
      budget: formatINR(data.fee),
      location: data.location || this.currentUser.location || '',
      deadline: deadline.getTime(),
      startsOn: data.startsOn ? dateOnlyMs(data.startsOn) : null,
      endsOn,
      tags: data.tags || [],
      requirements: [],
      talentType: data.talentType || 'ANY',
      slots: Math.max(1, Math.min(50, parseInt(data.slots, 10) || 1)),
      slotsFilled: 0,
      status: 'OPEN',
      applicationsCount: 0,
      timestamp: Date.now()
    };

    if (this.isRealAccount) {
      const { createLiveBrief } = await import('./briefsService.js');
      const saved = await createLiveBrief(newBrief);
      this.briefs.unshift(saved);
      this.notify();
      return saved;
    }

    const demoBrief = { id: `brief_${Date.now()}`, ...newBrief };
    this.briefs.unshift(demoBrief);
    this.save();
    return demoBrief;
  }

  getBrief(briefId) {
    return this.briefs.find(b => b.id === briefId)
      || this.applications.find(a => a.briefId === briefId && a.brief)?.brief
      || null;
  }

  // A brand's own campaigns, newest first.
  getMyCampaigns() {
    return this.briefs.filter(b => b.brandId === this.currentUser.id)
      .sort((x, y) => (y.timestamp || 0) - (x.timestamp || 0));
  }

  // Briefs a talent can apply to: made for their talent type (or open to
  // all) and still taking applications. Same city first, then newest.
  getOpenBriefsForTalent() {
    const me = this.currentUser;
    const type = talentTypeOf(me);
    return this.briefs
      .filter(b => b.brandId !== me.id && campaignStatus(b) === 'OPEN' && briefFitsTalent(b.talentType, type))
      .sort((x, y) => (sameCity(y.location, me.location) - sameCity(x.location, me.location))
        || ((y.timestamp || 0) - (x.timestamp || 0)));
  }

  getApplication(briefId, creatorId = this.currentUser.id) {
    return this.applications.find(a => a.briefId === briefId && a.creatorId === creatorId) || null;
  }

  hasAppliedToBrief(briefId) {
    return !!this.getApplication(briefId);
  }

  // A talent's own applications, newest first, each with its brief.
  getMyApplications() {
    return this.applications.filter(a => a.creatorId === this.currentUser.id)
      .map(a => ({ ...a, brief: this.briefs.find(b => b.id === a.briefId) || a.brief }))
      .filter(a => a.brief)
      .sort((x, y) => y.createdAt - x.createdAt);
  }

  // Everyone who applied to one campaign, first applied first (the review
  // deck order), each with their profile.
  getApplicantsForBrief(briefId) {
    return this.applications.filter(a => a.briefId === briefId)
      .map(a => ({ ...a, profile: a.profile || this.users.find(u => u.id === a.creatorId) || null }))
      .filter(a => a.profile)
      .sort((x, y) => x.createdAt - y.createdAt);
  }

  // Applicants still waiting on the brand's live campaigns (nav badge).
  pendingApplicantsCount() {
    const live = new Set(this.getMyCampaigns().filter(b => campaignStatus(b) === 'OPEN').map(b => b.id));
    return this.applications.filter(a => a.status === 'PENDING' && live.has(a.briefId)).length;
  }

  // The talent's accepted campaigns whose dates overlap this brief.
  getScheduleConflicts(creatorId, brief) {
    const win = briefWindow(brief);
    return this.applications
      .filter(a => a.creatorId === creatorId && a.status === 'SELECTED' && a.briefId !== brief.id)
      .map(a => this.briefs.find(b => b.id === a.briefId) || a.brief)
      .filter(b => b && windowsOverlap(briefWindow(b), win));
  }

  // Apply to a campaign with an optional pitch note (the fee is fixed, so
  // there's no rate). Saved first, then shown as applied. Resolves
  // { alreadyApplied } when the database already had this application.
  async applyToBrief(briefId, pitch = '') {
    const brief = this.getBrief(briefId);
    let alreadyApplied = false;
    // No double-booking: talent can't apply for dates they're already booked.
    const clash = brief && this.getScheduleConflicts(this.currentUser.id, brief)[0];
    if (clash) return { clash };

    if (this.isRealAccount && !brief?.isDemo) {
      const { applyToBriefRemote } = await import('./briefsService.js');
      try {
        await applyToBriefRemote(briefId, this.currentUser.id, pitch);
      } catch (err) {
        if (err?.code !== '23505') throw err; // 23505: one application per brief
        alreadyApplied = true;
      }
    }

    if (!this.getApplication(briefId)) {
      this.applications = [...this.applications, {
        briefId, creatorId: this.currentUser.id, pitch, status: 'PENDING',
        createdAt: Date.now(), decidedAt: null, matchId: null, brief
      }];
      if (!alreadyApplied) {
        this.briefs = this.briefs.map(b => b.id === briefId ? { ...b, applicationsCount: (b.applicationsCount || 0) + 1 } : b);
      }
    }

    this.save();
    return { alreadyApplied };
  }

  // The brand's decision on an applicant: 'SELECT' (Connect) or 'REJECT' (Pass).
  // Real campaigns go through decide_application() on the server, which
  // fills the slot, checks the talent's dates, opens the chat and, once the
  // last slot is filled, auto-rejects everyone still waiting. Resolves its
  // result: { status: SELECTED | REJECTED | CONFLICT | FULL | ALREADY_DECIDED }.
  async decideApplicant(briefId, creatorId, decision) {
    const brief = this.getBrief(briefId);
    if (!brief) throw new Error('Campaign not found');
    let res;

    if (this.isRealAccount && !brief.isDemo) {
      const { decideApplicationRemote } = await import('./briefsService.js');
      res = await decideApplicationRemote(briefId, creatorId, decision, false);
      if (res?.conflicts) {
        res.conflicts = res.conflicts.map(c => ({
          title: c.title,
          window: formatWindow({ startsOn: dateOnlyMs(c.starts_on), endsOn: dateOnlyMs(c.ends_on) })
        }));
      }
    } else {
      const clashes = decision === 'SELECT' ? this.getScheduleConflicts(creatorId, brief) : [];
      // Already booked on overlapping dates: they can't be selected.
      res = clashes.length
        ? { status: 'CONFLICT', conflicts: clashes.map(b => ({ title: b.title, window: formatWindow(b) })) }
        : this.decideLocally(briefId, creatorId, decision);
    }

    this.applyDecision(briefId, creatorId, res);
    return res;
  }

  // Demo campaigns: the same rules as decide_application(), locally.
  decideLocally(briefId, creatorId, decision) {
    const brief = this.getBrief(briefId);
    const app = this.getApplication(briefId, creatorId);
    if (!app) throw new Error('Application not found');
    if (app.status !== 'PENDING') return { status: 'ALREADY_DECIDED', application_status: app.status };
    if (decision === 'REJECT') return { status: 'REJECTED' };
    if (brief.status !== 'OPEN' || (brief.slotsFilled || 0) >= brief.slots) return { status: 'FULL' };

    const note = {
      id: `msg_sys_${Date.now()}`, senderId: this.currentUser.id, text: selectedNote(brief),
      type: 'system', timestamp: Date.now(), read: true
    };
    let match = this.matches.find(m => m.users.includes(this.currentUser.id) && m.users.includes(creatorId));
    if (match) {
      this.matches = this.matches.map(m => m.id === match.id
        ? { ...m, messages: [...(m.messages || []), note], lastMessage: note.text, lastSenderId: note.senderId, lastActive: note.timestamp }
        : m);
    } else {
      match = { id: `match_${Date.now()}`, users: [this.currentUser.id, creatorId], messages: [note], lastMessage: note.text, lastSenderId: note.senderId, lastActive: note.timestamp };
      this.matches = [match, ...this.matches];
    }

    const filled = (brief.slotsFilled || 0) + 1;
    const autoRejected = filled >= brief.slots
      ? this.applications.filter(a => a.briefId === briefId && a.status === 'PENDING' && a.creatorId !== creatorId).length
      : 0;
    return { status: 'SELECTED', match_id: match.id, slots: brief.slots, slots_filled: filled, auto_rejected: autoRejected };
  }

  // Mirror a decision in local state straight away (for real campaigns the
  // live subscriptions confirm it a moment later).
  applyDecision(briefId, creatorId, res) {
    if (!res || !['SELECTED', 'REJECTED'].includes(res.status)) return;
    const now = Date.now();
    const brief = this.getBrief(briefId);

    if (res.status === 'REJECTED') {
      this.applications = this.applications.map(a => a.briefId === briefId && a.creatorId === creatorId
        ? { ...a, status: 'REJECTED', decidedAt: now } : a);
    } else {
      const filled = res.slots_filled ?? ((brief.slotsFilled || 0) + 1);
      const full = filled >= (res.slots ?? brief.slots);
      this.briefs = this.briefs.map(b => b.id === briefId ? { ...b, slotsFilled: filled, status: full ? 'FILLED' : b.status } : b);
      this.applications = this.applications.map(a => {
        if (a.briefId !== briefId) return a;
        if (a.creatorId === creatorId) return { ...a, status: 'SELECTED', decidedAt: now, matchId: res.match_id || a.matchId };
        return full && a.status === 'PENDING' ? { ...a, status: 'AUTO_REJECTED', decidedAt: now } : a;
      });
      // Booked for these dates now: their other pending applications that
      // overlap are closed (decide_application does the same on the server).
      const win = briefWindow(brief);
      this.applications = this.applications.map(a => {
        if (a.creatorId !== creatorId || a.briefId === briefId || a.status !== 'PENDING') return a;
        const other = this.briefs.find(b => b.id === a.briefId) || a.brief;
        return other && windowsOverlap(briefWindow(other), win) ? { ...a, status: 'AUTO_REJECTED', decidedAt: now } : a;
      });
      // The chat is open now: list it in the Deal Room even before the live
      // match subscription delivers it.
      if (res.match_id && !this.matches.some(m => m.id === res.match_id)) {
        this.matches = [{
          id: res.match_id, users: [this.currentUser.id, creatorId], lastMessage: selectedNote(brief),
          lastSenderId: this.currentUser.id, lastActive: now, messages: []
        }, ...this.matches];
      }
    }
    this.save();
  }

  // Messaging & Proposals
  getMatchesForCurrentUser() {
    return this.matches.filter(m => m.users.includes(this.currentUser.id)).map(m => {
      // Ensure otherUser object is correctly mapped based on who current user is
      const otherId = m.users.find(id => id !== this.currentUser.id);
      const otherUser = this.users.find(u => u.id === otherId) || m.otherUser;
      return { ...m, otherUser };
    });
  }

  async sendMessage(matchId, text, type = 'text', proposalData = null) {
    const match = this.matches.find(m => m.id === matchId);
    if (!match) return;

    if (this.isRealAccount) {
      try {
        const { sendMessageRemote } = await import('./matchService.js');
        const proposalId = proposalData?.id || null;
        // The DB trigger on messages bumps the match preview and notifies the
        // recipient, so nothing else needs to be written from here.
        const saved = await sendMessageRemote(matchId, this.currentUser.id, text, type, proposalId);
        const newMsg = { ...saved, ...(proposalData ? { proposalData } : {}) };

        match.messages = match.messages || [];
        match.messages.push(newMsg);
        match.lastMessage = type === 'proposal' ? `Proposal: ${proposalData.title} (${proposalData.price})` : text;
        match.lastSenderId = this.currentUser.id;
        match.lastActive = Date.now();

        this.save();
        return newMsg;
      } catch (err) {
        console.error('Failed to send message:', err);
        throw err;
      }
    }

    const newMsg = {
      id: `msg_${Date.now()}`,
      senderId: this.currentUser.id,
      text,
      timestamp: Date.now(),
      read: true,
      type,
      ...(proposalData ? { proposalData } : {})
    };

    match.messages.push(newMsg);
    match.lastMessage = type === 'proposal' ? `Proposal: ${proposalData.title} (${proposalData.price})` : text;
    match.lastSenderId = this.currentUser.id;
    match.lastActive = Date.now();

    this.save();
    return newMsg;
  }

  // The person a Smart Proposal was sent to accepts or declines it. It's a
  // written record of what both sides agreed; payment is arranged between
  // them, outside Ping. A note in the chat shows the reply to both sides.
  async respondToProposal(matchId, messageId, response) {
    const match = this.matches.find(m => m.id === matchId);
    const msg = match?.messages?.find(m => m.id === messageId);
    const prop = msg?.proposalData;
    if (!prop) throw new Error('Proposal not found');
    let status = response;

    if (this.isRealAccount && !String(prop.id || '').startsWith('prop_')) {
      const { respondToProposalRemote } = await import('./matchService.js');
      const res = await respondToProposalRemote(prop.id, response);
      status = res?.status || response;
    } else {
      match.messages = [...match.messages, {
        id: `msg_sys_${Date.now()}`, senderId: this.currentUser.id, type: 'system', timestamp: Date.now(), read: true,
        text: `${this.currentUser.name} ${response === 'ACCEPTED' ? 'accepted' : 'declined'} the Smart Proposal: ${prop.title}`
      }];
    }

    match.messages = match.messages.map(m => m.id === messageId ? { ...m, proposalData: { ...m.proposalData, status } } : m);
    this.save();
    return status;
  }

  // Profile photo: square-cropped and shrunk, uploaded (real accounts) and
  // saved to the profile. The replaced photo file is cleaned up afterwards.
  async updateAvatar(file) {
    const { toAvatarJpeg, blobToDataUrl } = await import('./imageUtils.js');
    const blob = await toAvatarJpeg(file);
    if (!this.isRealAccount) {
      await this.updateCurrentUserProfile({ avatar: await blobToDataUrl(blob) });
      return;
    }
    const { uploadAvatar, removeAvatarFile } = await import('./authService.js');
    const previous = this.currentUser.avatar;
    const url = await uploadAvatar(this.currentUser.id, blob);
    await this.updateCurrentUserProfile({ avatar: url });
    removeAvatarFile(this.currentUser.id, previous).catch(() => {});
  }

  // Ask the Ping team to verify this profile (UNVERIFIED/REJECTED -> PENDING,
  // the only change the database lets members make to it themselves).
  async requestVerification() {
    await this.updateCurrentUserProfile({ verificationStatus: 'PENDING' });
  }

  // Admin Actions: saved to the member's real profile first (schema.sql only
  // lets an ADMIN change these fields), then reflected locally.
  async verifyUser(userId, approve = true) {
    if (this.isRealAccount) {
      const { setVerification } = await import('./adminService.js');
      await setVerification(userId, approve);
    }

    this.users = this.users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          verified: approve,
          verificationStatus: approve ? 'VERIFIED' : 'REJECTED'
        };
      }
      return u;
    });

    if (this.currentUser.id === userId) {
      this.currentUser.verified = approve;
      this.currentUser.verificationStatus = approve ? 'VERIFIED' : 'REJECTED';
    }

    this.save();
  }

  async setUserStatus(userId, status) {
    if (this.isRealAccount) {
      const { setMemberStatus } = await import('./adminService.js');
      await setMemberStatus(userId, status);
    }

    this.users = this.users.map(u => u.id === userId ? { ...u, status } : u);
    if (this.currentUser.id === userId) {
      this.currentUser.status = status;
    }
    this.save();
  }

  // Ping-team announcement to every active member (admin). Real accounts go
  // through admin_broadcast(); resolves { recipients }.
  async sendAnnouncement(title, body) {
    if (this.isRealAccount) {
      const { sendAnnouncement } = await import('./adminService.js');
      const res = await sendAnnouncement(title, body);
      this.announcements = [{ id: res?.id || `a_${Date.now()}`, title, body, timestamp: Date.now() }, ...(this.announcements || [])];
      this.notify();
      return { recipients: res?.recipients ?? 0 };
    }
    this.broadcasts.unshift({ id: `bcast_${Date.now()}`, title, body, timestamp: Date.now() });
    this.save();
    return { recipients: this.users.filter(u => !u.isDemo && u.id !== this.currentUser.id).length };
  }

  async loadAnnouncements() {
    if (!this.isRealAccount) {
      this.announcements = this.broadcasts || [];
      return this.announcements;
    }
    const { fetchAnnouncements } = await import('./adminService.js');
    this.announcements = await fetchAnnouncements(10);
    return this.announcements;
  }
}

export const store = new StateStore();
