# Project update for the agents (20 Oct 2026)

Owner: Bryan. Two products, both live as demos/MVPs. Hot Seat needs the outreach; Zist grows mostly through social media.

## 1. Hot Seat (team-building game) — needs outreach

**What it is:** a short, fun team game for remote and multinational teams, positioned as a cheaper, more playful alternative to Kahoot. A session is four rounds worth 25 points each (100 total): trivia, word unscramble, logic puzzles, and a sticky-note planning board (Miro-style). The host and mascot can be changed to match each organisation's brand.

**Status:** a working demo is live.
- Demo: https://hotseat-teams.netlify.app
- Personalised link builder: https://hotseat-teams.netlify.app/make.html — enter an org's name, colour, host and mascot to get a link with their branding plus a draft cold email (it includes an opt-out line).
- Tested end to end in a browser. Bryan has played it and likes it.

**Not built yet (build after pilots show interest):** real accounts and private leaderboards per organisation, custom question sets, server-side scoring, a Slack-first daily mode, and billing. Pricing is not set; the plan is to undercut Kahoot.

**Who to target first:** small remote-first teams (roughly 20–200 people) and Kenyan BPO/outsourcing companies, before large multinationals. Look for people who run team events, culture or people-ops.

**Outreach rules:**
- Verify every lead by hand: a real person at a real company. Never guess or invent email addresses.
- Bryan sends the emails himself. Drafts should be short, personalised with the demo link, and include an opt-out line.
- The goal of a first email is a 15-minute trial or pilot, not a sale.

**Open items / cautions:**
- Original or AI-written questions are safer for a paid product. Open Trivia DB content is CC BY-SA and needs attribution.
- Prize competitions in Kenya can be regulated (BCLB), so keep prizes out of early pilots.
- Payments: Stripe does not support Kenyan businesses. Options to check: Paddle, Lemon Squeezy, Paystack, IntaSend, Pesapal.

## 2. Zist — "Letterboxd for restaurants" — light outreach, mostly social

**What it is:** search any restaurant, rate it 1–5 stars, write a short review, add photos, and build a public Top 5 of favourites, with a shareable "My Top 5" image card. "Zist it" is the brand hook. Restaurants (new ones wanting promotion) and advertisers are the future revenue, not users.

**Status:** MVP is live at https://zist-reviews.netlify.app (it will move to zist.it.com soon; Bryan is switching the domain himself).
- Catalogue: 12,812 restaurants across 43 cities in 37 countries, from open map data. More cities can be loaded in batches.
- Users sign in with an emailed 6-digit code. Google sign-in is not set up yet, by choice.
- Top 5 is independent of reviews: people search and add the places they go to.
- Moderation is in: a report button, an admin page with a reports queue, and the ability to ban users (their reviews are hidden and they cannot post).
- Tested end to end on the live site.

**How it should grow:** social media. Good content: people sharing their Top 5 cards, "rate your city's best" challenges, local food creators and communities in Nairobi first, then other cities in the catalogue. Seed some real reviews before pushing hard, so restaurant pages are not empty.

**Light outreach worth doing:** a handful of food creators and local community accounts. Restaurant and advertiser outreach should wait until there are real ratings to show them.

**Open items:**
- Move zist.it.com onto the new app (Bryan will do this).
- More cities and a city-first browse page.
- Restaurant owner claims (the database already has claim and plan fields).
- Restaurants added by users have no verification yet; admin tools to edit or remove a restaurant are not built.

## Paused

ZCM (Kijani Ridge community marketplace) is live and polished but parked because it is hard to scale. Nothing is needed from the agents.
