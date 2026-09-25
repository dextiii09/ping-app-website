// Ping Web Platform - "Ping AI" Intelligence Service
// User-facing name is always "Ping AI" - the underlying model (Gemini) is an
// implementation detail and never surfaced in UI copy.
//
// No API key ships in this file, or anywhere else in client source. The
// old hardcoded key was a live secret sitting in a static .js file every
// visitor's browser downloaded - see AUDIT_REPORT.md. The actual key now
// lives only in the `generateAiText` Cloud Function's secret config
// (functions/index.js) and is called through Firebase Callable Functions,
// which requires the caller to be a signed-in Firebase Auth user - it's
// never reachable by an anonymous script scraping this file. Every method
// below already falls back to curated canned responses if the function call
// fails for any reason (not deployed yet, network error, etc.), so AI
// features degrade gracefully rather than breaking.
import { supabase } from './supabaseClient.js';

export const aiService = {
  // Calls the generate-ai-text Supabase Edge Function (JWT-verified, so only signed-in users).
  async callPingAI(prompt) {
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-text', { body: { prompt } });
      if (error) throw error;
      return data?.text || null;
    } catch (err) {
      console.warn('AI live call fallback:', err);
      return null;
    }
  },

  // Generate high-conversion Bio based on persona & tone
  async generateBio(name, role, tags, tone = 'Professional') {
    const isBusiness = role === 'BUSINESS';
    const tagStr = tags && tags.length ? tags.slice(0, 3).join(', ') : 'innovation';

    // 1. Attempt live Ping AI call
    const livePrompt = `Write a ${tone} bio (maximum 2 sentences, punchy) for ${name}, a ${isBusiness ? 'local business' : 'creator'} working in ${tagStr}, for their profile on Ping, a marketplace that connects local creators and businesses. Only use the facts given here: do not invent numbers, results, awards, clients or claims. Do not include quotes.`;
    const liveResult = await this.callPingAI(livePrompt);
    if (liveResult) return liveResult;

    // 2. Curated Fallback: built only from what we actually know (niches),
    // so it never puts invented stats or claims on someone's public profile.
    await new Promise(r => setTimeout(r, 600));

    if (isBusiness) {
      switch (tone) {
        case 'Hype':
          return `All about ${tagStr}. Looking for local creators with real energy to help more people discover us. ⚡`;
        case 'Creative':
          return `A local ${tagStr} business with a story worth telling. Looking for creators who can capture what makes us different. ✨`;
        case 'Witty':
          return `We do ${tagStr}, and we'd love more people to know it. If your audience would love us too, let's talk. 🥂`;
        case 'Professional':
        default:
          return `Local business in ${tagStr}, open to collaborations with creators whose audience fits ours. Reach out with your ideas and rates. 💼`;
      }
    } else {
      switch (tone) {
        case 'Hype':
          return `Creating ${tagStr} content that people actually stop scrolling for. Always up for a local collab. 🔥`;
        case 'Creative':
          return `Telling stories around ${tagStr}, one frame at a time. Open to collaborations with local brands that care about the details. ✨`;
        case 'Witty':
          return `I make ${tagStr} content and I'm always hunting for the next great local spot. Got one? Let's talk. 😉`;
        case 'Professional':
        default:
          return `Creator focused on ${tagStr}, open to collaborations with local brands. Message me for rates and availability. 🚀`;
      }
    }
  },

  // Generate 3 icebreakers/follow-ups. `transcript` (built by the caller,
  // which knows who "I"/"they" are - this service doesn't) is a short plain
  // text rendering of the actual recent messages, or '' for a brand-new
  // match with no messages yet. Previously this only ever looked at the
  // other person's name/role/tags and produced the exact same 3 lines no
  // matter what had already been said in the chat - this makes the prompt
  // (and the non-AI fallback) genuinely branch on whether a conversation is
  // already underway.
  async generateIcebreakers(matchName, matchRole, matchTags = [], transcript = '', hasProposal = false) {
    const tag = matchTags[0] || 'collaboration';
    const tag2 = matchTags[1] || 'content';
    const hasHistory = transcript.trim().length > 0;

    const livePrompt = hasHistory
      ? `Here is my recent Deal Room conversation with ${matchName} (${matchRole}) on Ping, a creator-business marketplace:\n\n${transcript}\n\nSuggest exactly 3 short, natural follow-up messages I could send next to keep this conversation moving toward a deal. Reference what was actually said where relevant. Return strictly 3 lines separated by newline, no numbering.`
      : `Generate exactly 3 short, conversational icebreakers for reaching out to ${matchName} (${matchRole}) interested in ${tag} and ${tag2}. Return strictly 3 lines separated by newline.`;

    const liveResult = await this.callPingAI(livePrompt);
    if (liveResult) {
      const lines = liveResult.split('\n').map(l => l.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);
      if (lines.length >= 2) return lines.slice(0, 3);
    }

    await new Promise(r => setTimeout(r, 400));

    // Curated fallback (no live AI call available): still branches on
    // whether the conversation has started, so it doesn't suggest a cold
    // open into a chat that's already three messages deep.
    if (hasHistory) {
      return [
        `Thanks for that, ${matchName} — what would you say is the ideal timeline on your end?`,
        hasProposal
          ? `Any questions on the proposal, or does it look good to you?`
          : `Should we lock in the scope for ${tag} so we can move to a Smart Proposal?`,
        `Happy to jump on a quick call if that's easier — let me know what works for you!`
      ];
    }

    if (matchRole === 'BUSINESS') {
      return [
        `Hey ${matchName}! I create ${tag} content and I'd love to put together an idea for you. What are you hoping to promote next?`,
        `Hi team! Are you taking on creator collaborations right now? ${tag} and ${tag2} are what I focus on.`,
        `Quick question for ${matchName}: what matters most to you from a ${tag} collab, more footfall or more people knowing your name?`
      ];
    } else {
      return [
        `Hey ${matchName}! Your ${tag} content looks like a great fit for us. Open to a collaboration?`,
        `Hi! We're planning some ${tag} content and would love your take. Free for a quick chat about scope?`,
        `Would love to discuss a collaboration around ${tag2} if your calendar has room!`
      ];
    }
  },

  // Generate real-time AI Match Rationale & 3 Strategic Insights
  // Match score from real, explainable signals on both profiles - nothing
  // invented. 35 base, +10 creator<->brand, +15 per shared niche (max 30),
  // +15 same city, +5 verified, +5 rates/budget listed. The reason and the
  // insights only state facts that are actually true for this pair.
  generateMatchAnalysis(userA, userB) {
    const tagsA = userA?.tags || [];
    const tagsB = userB?.tags || [];
    const shared = tagsA.filter((t) => tagsB.includes(t));
    const city = (loc) => (loc || '').split(',').pop().trim().toLowerCase();
    const cityA = city(userA?.location);
    const cityB = city(userB?.location);
    const sameCity = !!cityA && cityA === cityB;
    const complementary = !!userA && !!userB && userA.role !== userB.role
      && ['INFLUENCER', 'BUSINESS'].includes(userA.role) && ['INFLUENCER', 'BUSINESS'].includes(userB.role);
    const rc = userB?.settings?.rateCard || {};
    const listsRates = userB?.isDemo ? !!userB?.stats?.budget
      : userB?.role === 'BUSINESS' ? !!userB?.settings?.budgetRange : !!(rc.reel || rc.storySequence || rc.eventAppearance);

    let score = 35;
    if (complementary) score += 10;
    score += Math.min(shared.length * 15, 30);
    if (sameCity) score += 15;
    if (userB?.verified) score += 5;
    if (listsRates) score += 5;
    score = Math.min(score, 100);

    const bits = [];
    if (shared.length) bits.push(`you both work in ${shared.join(' & ')}`);
    if (sameCity) bits.push(`you're both in ${(userB.location || '').split(',').pop().trim()}`);
    const reason = bits.length
      ? `${score}% match: ${bits.join(' and ')}.`
      : `${score}% match: no shared niche or city yet, but worth a look if their work fits yours.`;

    const insights = [];
    insights.push(shared.length
      ? `Shared niche: ${shared.join(', ')}.`
      : `Different niches: they focus on ${tagsB.slice(0, 3).join(', ') || 'topics they haven\'t listed yet'}.`);
    if (cityA && cityB) insights.push(sameCity ? `Both based in ${(userB.location || '').split(',').pop().trim()}.` : `They're in ${userB.location}; you're in ${userA.location}.`);
    insights.push(userB?.verified ? 'Their identity is verified by Ping.' : 'Not verified yet.');
    insights.push(listsRates ? (userB.role === 'BUSINESS' ? 'They\'ve listed a budget range.' : 'They\'ve listed their rates.') : 'No rates listed yet. Ask in the Deal Room.');

    return { score, reason, insights };
  },

  // Generate formal proposal terms draft
  async generateProposalTerms(title, budget, deliverableSummary) {
    await new Promise(r => setTimeout(r, 300));
    return {
      scopeOfWork: `Deliverables: ${deliverableSummary}. All deliverables must adhere to brand aesthetic guidelines with 1 round of revisions included.`,
      licensing: `Brand receives full 12-month organic and digital paid media usage rights across social channels with proper talent credit.`,
      milestoneSplit: [
        { percentage: 30, title: "Concept & Script Sign-off" },
        { percentage: 40, title: "Rough Cut & Brand Review" },
        { percentage: 30, title: "Final Publication & Deliverables Handover" }
      ]
    };
  }
};
