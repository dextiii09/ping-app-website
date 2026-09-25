// Ping Web Platform - State Store & Persistence Layer
import { SEED_USERS, SEED_BRIEFS, SEED_MATCHES, SEED_ADMIN_STATS } from './mockData.js';

const STORAGE_KEY = 'ping_platform_state_v1';

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
        this.currentUser = parsed.currentUser || SEED_USERS[0];
        this.users = parsed.users || SEED_USERS;
        this.briefs = parsed.briefs || SEED_BRIEFS;
        this.matches = parsed.matches || SEED_MATCHES;
        this.adminStats = parsed.adminStats || SEED_ADMIN_STATS;
        this.swipes = parsed.swipes || {}; // userId -> array of swiped candidate ids
        this.activeBriefApplications = parsed.activeBriefApplications || {};
        this.broadcasts = parsed.broadcasts || [];
        this.notifications = []; // live-only, populated by loadNotifications() for real accounts
        return;
      } catch (e) {
        console.warn('Failed to parse cached state, restoring seeds', e);
      }
    }

    // Default Fresh Seed
    this.currentUser = SEED_USERS[0]; // Alex Vance (Creator)
    this.users = [...SEED_USERS];
    this.briefs = [...SEED_BRIEFS];
    this.matches = [...SEED_MATCHES];
    this.adminStats = { ...SEED_ADMIN_STATS };
    this.swipes = {};
    this.activeBriefApplications = {};
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
        currentUser: this.currentUser,
        users: this.users,
        briefs: this.briefs,
        matches: this.matches,
        adminStats: this.adminStats,
        swipes: this.swipes,
        activeBriefApplications: this.activeBriefApplications,
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

  // Real accounts (Firebase Auth + Firestore `users/{uid}` profile)
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
    this.save();
    this.loadRealBriefs();
    this.loadRealMatches();
    this.loadRealDiscoveryCandidates();
    this.loadBlockedUsers();
    this.loadNotifications();
    this.loadMyActivity();
  }

  // Who you've already swiped and which briefs you've pitched on live in the
  // database, not just this browser's cache - so a new device (or a cleared
  // cache) doesn't show people you've passed on, or let you pitch twice.
  // Demo profiles are only ever swiped locally, so those are kept as-is.
  async loadMyActivity() {
    const uid = this.currentUser.id;
    try {
      const [{ fetchMySwipedIds }, { fetchMyPitches }] = await Promise.all([
        import('./matchService.js'), import('./briefsService.js')
      ]);
      const [swipedIds, pitches] = await Promise.all([fetchMySwipedIds(uid), fetchMyPitches(uid)]);
      if (this.currentUser.id !== uid) return;
      this.swipes[uid] = [...new Set([...(this.swipes[uid] || []), ...swipedIds])];
      pitches.forEach((p) => {
        this.activeBriefApplications[`${uid}_${p.briefId}`] = { pitchMessage: p.pitch, rate: p.rate, timestamp: p.timestamp };
      });
      this.save();
    } catch (err) {
      console.error('Failed to load swipe/pitch history:', err);
    }
  }

  // Live-subscribes to OTHER real users' discoverable profiles
  // (public_profiles collection - see discoveryService.js for why this is
  // separate from users/{uid}) and merges them into the local candidate
  // pool alongside the mock seed users, so getDiscoveryCandidates() keeps
  // working unchanged. Also what makes the admin verification queue update
  // live, since opsPlatform.js reads store.users directly.
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

  // Replaces the mock-seeded matches list with a LIVE subscription to
  // Firestore `matches` (array-contains query on the current uid) - a new
  // match, or a lastMessage/lastActive change on an existing one, updates
  // the list automatically. Messages are NOT included here - they're
  // subscribed to lazily per-match via loadMessagesForMatch when a
  // conversation is actually opened, matching the subcollection shape.
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
      console.error('Failed to subscribe to matches from Firestore:', err);
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

  // Creates a Smart Proposal. Real accounts get a flat proposal (title,
  // price, deadline, description) written to the real `proposals` collection
  // - there is no validated milestones schema server-side yet. Mock/demo
  // accounts keep the full milestone-breakdown behavior for the visual demo.
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
      status: 'PENDING',
      milestones: [
        { id: 'm1', title: 'Concept & Creative Direction', amount: '30%', status: 'PAID' },
        { id: 'm2', title: 'First Rough Cut Review', amount: '40%', status: 'UNDER_REVIEW' },
        { id: 'm3', title: 'Final Publish & Live Metrics', amount: '30%', status: 'LOCKED' }
      ]
    };
    return this.sendMessage(matchId, `Smart Proposal Created: ${proposalFields.title}`, 'proposal', proposalData);
  }

  // Trust & safety: loads who the current real account has blocked, so
  // getDiscoveryCandidates() can exclude them. Blocking is local to the
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

  // Discovery & Swiping
  getDiscoveryCandidates() {
    const currentRole = this.currentUser.role;
    const swipedIds = this.swipes[this.currentUser.id] || [];
    const blockedIds = this.blockedUserIds || new Set();
    // Already matched: they're in the Deal Room, and pinging them again would
    // send them a second "You matched" notification.
    const matchedIds = new Set(this.matches.filter(m => m.users.includes(this.currentUser.id)).flatMap(m => m.users));

    return this.users.filter(u => {
      if (u.id === this.currentUser.id) return false;
      if (u.status === 'BANNED') return false;
      if (swipedIds.includes(u.id)) return false;
      if (blockedIds.has(u.id)) return false;
      if (matchedIds.has(u.id)) return false;

      // Businesses discover Influencers; Influencers discover Businesses; Admins see all
      if (currentRole === 'BUSINESS') return u.role === 'INFLUENCER';
      if (currentRole === 'INFLUENCER') return u.role === 'BUSINESS';
      return true;
    });
  }

  async recordSwipe(candidateId, direction) {
    if (!this.swipes[this.currentUser.id]) {
      this.swipes[this.currentUser.id] = [];
    }
    this.swipes[this.currentUser.id].push(candidateId);

    if (this.isRealAccount) {
      const candidate = this.users.find(u => u.id === candidateId);
      // Demo profiles have no account behind them: the swipe only moves the deck on.
      if (candidate?.isDemo) {
        this.save();
        return false;
      }
      try {
        const { recordSwipeRemote } = await import('./matchService.js');
        const { matched, matchId } = await recordSwipeRemote(this.currentUser.id, candidateId, direction);

        if (matched) {
          const newMatch = {
            id: matchId,
            users: [this.currentUser.id, candidateId],
            otherUser: candidate,
            lastMessage: direction === 'UP' ? '⚡ Super-Pinged you!' : 'Connected on Ping',
            lastSenderId: this.currentUser.id,
            lastActive: Date.now(),
            messages: []
          };
          const idx = this.matches.findIndex(m => m.id === matchId);
          if (idx === -1) this.matches.unshift(newMatch); else this.matches[idx] = newMatch;
        }

        this.save();
        return matched;
      } catch (err) {
        // Nothing was saved: undo the optimistic swipe so the card comes
        // back, and let the caller tell the user.
        const list = this.swipes[this.currentUser.id];
        const i = list.lastIndexOf(candidateId);
        if (i !== -1) list.splice(i, 1);
        this.save();
        throw err;
      }
    }

    // Mock/demo path
    let matched = false;
    if (direction === 'RIGHT' || direction === 'UP') {
      const candidate = this.users.find(u => u.id === candidateId);
      if (candidate) {
        const existing = this.matches.find(m =>
          m.users.includes(this.currentUser.id) && m.users.includes(candidateId)
        );

        if (!existing) {
          const newMatch = {
            id: `match_${Date.now()}`,
            users: [this.currentUser.id, candidateId],
            otherUser: candidate,
            lastMessage: direction === 'UP' ? '⚡ Super-Pinged you!' : 'Connected on Ping',
            lastSenderId: this.currentUser.id,
            lastActive: Date.now(),
            aiMatchReason: "95% Match: Verified high affinity in complementary niches.",
            messages: [
              {
                id: `msg_init_${Date.now()}`,
                senderId: this.currentUser.id,
                text: direction === 'UP' ? '⚡ Sent a Super-Ping! High-priority partnership interest.' : 'Hi! Loved your profile, let\'s connect.',
                timestamp: Date.now(),
                read: true,
                type: 'text'
              }
            ]
          };
          this.matches.unshift(newMatch);
          matched = true;
        }
      }
    }

    this.save();
    return matched;
  }

  // Live Briefs
  async createBrief(briefData) {
    const newBrief = {
      brandId: this.currentUser.id,
      brandName: this.currentUser.company || this.currentUser.name,
      brandAvatar: this.currentUser.avatar,
      title: briefData.title,
      description: briefData.description,
      budget: briefData.budget.startsWith('₹') ? briefData.budget : `₹${briefData.budget}`,
      // Ping is local: a brief is for creators near the brand unless it says otherwise.
      location: briefData.location || this.currentUser.location || '',
      deadline: Date.now() + (parseInt(briefData.days || 14) * 24 * 60 * 60 * 1000),
      tags: briefData.tags || ['Partnership'],
      requirements: briefData.requirements || [],
      requiredVideos: parseInt(briefData.requiredVideos || 1),
      requiredStories: parseInt(briefData.requiredStories || 2),
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

    const mockBrief = { id: `brief_${Date.now()}`, ...newBrief };
    this.briefs.unshift(mockBrief);
    this.save();
    return mockBrief;
  }

  // Saves the pitch first and only then marks it as sent, so a failed save
  // can't show "pitch sent". Resolves { alreadyPitched: true } when the
  // database already has a pitch from this creator on this brief.
  async applyToBrief(briefId, pitchMessage, rate) {
    const key = `${this.currentUser.id}_${briefId}`;
    const brief = this.briefs.find(b => b.id === briefId);
    let alreadyPitched = false;

    if (this.isRealAccount && !brief?.isDemo) {
      const { applyToBriefRemote } = await import('./briefsService.js');
      try {
        await applyToBriefRemote(briefId, this.currentUser.id, pitchMessage, rate);
      } catch (err) {
        if (err?.code !== '23505') throw err; // 23505: unique violation, one pitch per brief
        alreadyPitched = true;
      }
    }

    this.activeBriefApplications[key] = {
      pitchMessage,
      rate,
      timestamp: Date.now()
    };

    if (!alreadyPitched) {
      this.briefs = this.briefs.map(b => {
        if (b.id === briefId) {
          return { ...b, applicationsCount: (b.applicationsCount || 0) + 1 };
        }
        return b;
      });
    }

    this.save();
    return { alreadyPitched };
  }

  hasAppliedToBrief(briefId) {
    return !!this.activeBriefApplications[`${this.currentUser.id}_${briefId}`];
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

  signAndAcceptProposal(matchId, messageId, signatureName) {
    const match = this.matches.find(m => m.id === matchId);
    if (!match) return;

    const msg = match.messages.find(m => m.id === messageId);
    if (!msg || !msg.proposalData) return;

    msg.proposalData.status = 'ACCEPTED';
    msg.proposalData.creatorSignature = signatureName || this.currentUser.name;
    
    // Add confirmation message
    match.messages.push({
      id: `msg_signed_${Date.now()}`,
      senderId: this.currentUser.id,
      text: `✅ Proposal accepted by ${msg.proposalData.creatorSignature}.`,
      timestamp: Date.now(),
      read: true,
      type: 'text'
    });

    match.lastMessage = `Proposal Accepted & Signed`;
    match.lastActive = Date.now();

    this.save();
  }

  updateMilestoneStatus(matchId, messageId, milestoneId, newStatus, contentUrl = null) {
    const match = this.matches.find(m => m.id === matchId);
    if (!match) return;

    const msg = match.messages.find(m => m.id === messageId);
    if (!msg || !msg.proposalData || !msg.proposalData.milestones) return;

    const milestone = msg.proposalData.milestones.find(m => m.id === milestoneId);
    if (!milestone) return;

    milestone.status = newStatus;
    if (contentUrl) milestone.contentUrl = contentUrl;

    // Send milestone alert
    match.messages.push({
      id: `msg_mile_${Date.now()}`,
      senderId: this.currentUser.id,
      text: `📌 Milestone status updated: "${milestone.title}" is now [${newStatus}].`,
      timestamp: Date.now(),
      read: true,
      type: 'text'
    });

    this.save();
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

  postBroadcast(title, body) {
    const bcast = {
      id: `bcast_${Date.now()}`,
      title,
      body,
      timestamp: Date.now()
    };
    this.broadcasts.unshift(bcast);
    this.save();
  }
}

export const store = new StateStore();
