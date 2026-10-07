# Launching a new estate / apartment complex

No code changes or redeploys. About 15 minutes of your time, plus the admin's.

## Before
- [ ] Pick a **community admin** (caretaker, chairperson, or a trusted resident). They'll verify neighbours, so choose someone who knows who lives there.
- [ ] Agree what counts as proof of residence (unit number + a neighbour who can vouch is usually enough).
- [ ] Decide the slug (`green-park`) and display name (`Green Park`).

## Set up (SQL editor, ~2 min)
1. Ask the admin to **sign in once** at your site (this creates their account).
2. Run: `select create_community('green-park', 'Green Park', 'Nairobi', 'admin@example.com');`
   It creates the community, its invite link, and makes that person the verified admin. (If they hadn't signed in yet, it tells you the one-liner to run afterwards.)
3. Open `/c/green-park/admin` as the admin and copy the **invite link**.

## Seed it before opening the doors (the part that matters)
- [ ] Have **5–10 real listings** ready: 2–3 services people always ask about (cleaner, gardener, handyman) and 3–5 products (baker, produce, crafts). Ask the admin to nominate sellers and help them list.
- [ ] Admin posts a short **announcement**: what this is, how verification works, how to list.
- [ ] Admin verifies those first sellers themselves (they're known to the admin).

## Open the doors
- [ ] Share the invite link in the estate WhatsApp group with a one-line pitch ("Looking for a good plumber? It's all here now").
- [ ] Verify applicants **within 24h** — a slow first approval is the biggest drop-off. Admin gets a notification for each new applicant.
- [ ] Encourage residents to use their own "Invite on WhatsApp" button on the feed (their username is attached, which shows up as a vouch in your queue).

## First two weeks
- [ ] Check `/c/<slug>/admin` daily: pending verifications, open reports.
- [ ] Nudge new neighbours to leave a review after their first completed order — reviews are what make the services tab trustworthy.
- [ ] Note which categories are searched but empty; recruit sellers for those.

## Settings per community
- Currency: `update communities set currency = 'KES' where slug = '...';`
- Rotate a leaked invite link from the admin page; the old link stops working immediately.
