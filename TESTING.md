# Manual test script (two real accounts)

Prereqs: migrations 0001–0005 + seed applied, env vars set, `npm run dev`. Use two browsers (or one + a private window).
Call them **Admin** (you) and **Neighbour** (a friend / second email).

1. **Admin**: sign in → pick username → Join Kijani Ridge → run the bootstrap SQL in `supabase/seed.sql` → reload; you land in the community.
2. **Neighbour**: sign in → username → join with a unit number. Sees "pending", cannot open `/c/kijani-ridge/services` (redirects home).
3. **Admin**: 🔔 shows "New resident to verify" → Admin → Verify. **Neighbour** gets "You're verified" and can now browse.
4. **Admin** → Sell: create a *product* (price, stock 3) and a *service*; add 2 photos on the next screen. Check photos show on the feed and detail page.
5. **Neighbour**: open the product → Reserve ×2 with a note. Try reserving ×2 again → "Not enough stock left".
6. **Admin**: 🔔 + Orders (1) → Accept. **Neighbour**: gets "Accepted" → Orders → upload a screenshot + reference → "Payment proof sent".
7. **Admin**: view screenshot → Reject proof; **Neighbour** gets "rejected", re-uploads; **Admin** → Confirm. Stock drops 3 → 1. Neighbour gets "Order completed".
8. **Neighbour**: leave a 5★ review; try reviewing your own listing as Admin (should be blocked).
9. **Chat**: Neighbour → Message @admin; send a few messages; Admin sees them arrive live and an unread badge in Inbox.
10. **Moderation**: Neighbour reports the listing → Admin sees it in Admin → Remove content. Try Shadowban on Neighbour → Admin's feed/chat no longer shows their content; Neighbour still sees their own.
11. **Expiry**: reserve something and, in the SQL editor, `update reservations set expires_at = now() - interval '1 hour'; select expire_reservations();` → status becomes "Expired", both notified.
12. **Plans**: as Admin make yourself a business seller, then `update sellers set plan='pro' where user_id = '<your id>'` → Dashboard unlocks and "Feature 7 days" appears.
13. **Security spot-check**: sign in as a third user who has NOT been verified → every community page redirects; direct API reads of `listings`/`messages` return nothing.
14. **Invite flow**: as Admin copy the invite link from Admin; open it in a private window → "You're invited" → Sign in → Join form shows only that community. Apply; Admin's queue shows "Invited by …" if the link had your username.
15. **Feed**: Admin posts a pinned announcement → it shows at the top of the community home. New listings appear under "Recently added".
16. **Video**: edit a listing → upload a short MP4 (<20 MB); it plays on the listing page and the feed card shows "▶ video". A second video on a free plan is refused.
17. **Rotate**: Admin → "Make a new link"; the old invite link now says "isn't valid any more".
