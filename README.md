# Ping ⚡

**Local brands. Local creators. One ping apart.**

Ping is a hyperlocal creator–business marketplace by **ReachUp Media**. Local businesses and local micro & nano creators find each other by neighbourhood and niche, chat, and agree collaborations in writing, without an agency in between. It's in a free pilot.

Live at **https://pingapp.site**

---

## What's in it

- **Landing page:** scroll-driven story (GSAP + Lenis) ending in "I'm a creator" / "I'm a brand".
- **Sign-up and log-in:** email (with confirmation) or Google / Facebook, then role, location and niches.
- **Explore & Match:** a swipe deck and a grid of nearby creators or brands. The match score is explainable and comes only from real signals: shared niches, same city, verification, listed rates.
- **Campaign Briefs:** brands post briefs, creators pitch with a rate.
- **Deal Room:** chat between matched members, plus Smart Proposals (a written offer: title, price, deadline). There are no in-app payments or escrow.
- **Media Kit:** profile, rate card and self-reported audience figures, with a printable / PDF view.
- **Operations (admin):** approve or decline verification requests, suspend or reactivate members.

## Tech

- Static site: vanilla JavaScript ES modules, no build step.
- [Supabase](https://supabase.com): Auth, Postgres with row-level security, Realtime, Edge Functions.
- Hosted on [Vercel](https://vercel.com). `vercel.json` sets the security headers (including the Content-Security-Policy), and `.vercelignore` keeps non-site files out of the deploy.

```
index.html              app shell + routing (landing, #login, #join-creator, #join-brand)
privacy.html, terms.html
assets/js/              state.js, platform.js, *Service.js, views/, landing/
assets/css/             landing.css, platform.css, app-theme.css
supabase/schema.sql     tables, RLS policies, triggers, record_swipe()
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

1. Run `supabase/schema.sql` in the Supabase SQL Editor.
2. Create the admin: sign up with the admin email, then run `supabase/admin_setup.sql`.
3. Optional email notifications: follow the comments in `supabase/email_notifications.sql` and `supabase/functions/send-notification-email`.
4. Ping AI: `supabase functions deploy generate-ai-text` and `supabase secrets set GEMINI_API_KEY=...`. Until then the app falls back to built-in text.
5. Authentication → URL Configuration: Site URL `https://pingapp.site`, and add `https://pingapp.site/**` to Redirect URLs.
