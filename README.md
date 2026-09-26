# Ping ⚡

**Local brands. Local creators. One ping apart.**

Ping is a hyperlocal creator–business marketplace by **ReachUp Media**. Local businesses and local micro & nano creators find each other by neighbourhood and niche, chat, and agree collaborations in writing, without an agency in between. It's in a free pilot.

Live at **https://pingapp.site**

---

## What's in it

- **Landing page:** scroll-driven story (GSAP + Lenis) ending in "I'm a creator" / "I'm a brand".
- **Sign-up and log-in:** email (with confirmation) or Google / Facebook, then role, location and niches.
- **Campaigns (brands):** post a campaign with a fixed fee per person, the number of slots, the talent type (influencer, comedian, DJ, band or artist), deliverables and the deadline / event date. Then review applicants one card at a time: swipe right to select (fills a slot and opens a chat straight away), left to pass. When every slot is filled, everyone still waiting is told the campaign is filled. Talent is never double-booked: someone already booked on overlapping dates can't apply or be picked, and being picked closes their other pending applications on those dates.
- **Discover (talent):** open campaigns for your talent type, nearest first. The fee is fixed and shown upfront; apply in one tap with an optional pitch note, to as many campaigns as you like.
- **My applications (talent):** waiting, selected (with the chat), not selected.
- **Deal Room:** chat, opened by a selection, plus Smart Proposals (a written offer: title, price, deadline) that the other side accepts or declines, with the reply noted in the chat. There are no in-app payments or escrow.
- **Media Kit:** profile photo, talent type with type-specific details (genres and gigs for DJs, show reel for comedians, ...), past-work links, audience figures, a "get verified" request, printable / PDF view.
- **Operations (admin):** verification requests (with the member's links to check), announcements to every member (in-app notification, plus email if set up), suspend or reactivate members.

## Tech

- Static site: vanilla JavaScript ES modules, no build step.
- [Supabase](https://supabase.com): Auth, Postgres with row-level security, Realtime, Storage (profile photos), Edge Functions.
- Hosted on [Vercel](https://vercel.com). `vercel.json` sets the security headers (including the Content-Security-Policy), and `.vercelignore` keeps non-site files out of the deploy.

```
index.html              app shell + routing (landing, #login, #join-creator, #join-brand)
privacy.html, terms.html
assets/js/              state.js, platform.js, *Service.js, views/, landing/
assets/css/             landing.css, platform.css, app-theme.css
supabase/schema.sql     tables, RLS policies, triggers
supabase/campaign_matching.sql   talent types, slots, applications, decide_application()
supabase/extras.sql     profile photos, announcements, proposal replies
supabase/functions/     generate-ai-text, send-notification-email
```

## Run locally

```bash
node serve.js
```

Then open http://localhost:3000.

To test with the same security headers as production (useful after touching `vercel.json` or adding a new CDN):

```bash
node serve.js --prod --port=3001
```

## Deploy

Pushing to `master` deploys to Vercel automatically.

## Supabase setup

1. In the Supabase SQL Editor, run in this order:
   - `supabase/schema.sql` (tables, policies, triggers);
   - `supabase/campaign_matching.sql` (campaign matching flow: talent types, slots, application statuses and `decide_application()`);
   - `supabase/extras.sql` (the `avatars` storage bucket for profile photos, announcements with `admin_broadcast()`, and proposal replies with `respond_to_proposal()`).

   The last two are safe to run again.
2. Create the admin: sign up with the admin email, then run `supabase/admin_setup.sql`.
3. Optional email notifications: follow the comments in `supabase/email_notifications.sql` and `supabase/functions/send-notification-email`.
4. Ping AI: `supabase functions deploy generate-ai-text` and `supabase secrets set GEMINI_API_KEY=...`. Until then the app falls back to built-in text.
5. Authentication → URL Configuration: Site URL `https://pingapp.site`, and add `https://pingapp.site/**` to Redirect URLs.
