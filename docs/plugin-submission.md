# Submitting Zist to the ChatGPT plugin directory

The package is `plugin/` (built into `zist-plugin-1.1.0.zip` by `python3 scripts/build-plugin-zip.py`).
The server is live at **https://zist.it.com/mcp** (Streamable HTTP, no sign-in, read-only tools). Docs: https://developers.openai.com/plugins/deploy/submission

## What only you can do
1. **Verify your identity with OpenAI** (required, enforced at review): platform.openai.com/settings/organization/general. Individual verification publishes under your name; business verification under a company name. Use a project with *global* data residency (EU-residency projects can't submit MCP plugins yet).
2. **Upload the ZIP**: platform.openai.com/plugins → *Upload new or existing plugin* → pick your verified developer identity → upload `zist-plugin-1.1.0.zip`. Fix anything under *Metadata & Skills → Issues*.
3. **Connect the MCP server**: MCPs → Connect → URL `https://zist.it.com/mcp`, authentication **none**. The portal shows a **domain-verification token**. Give it to Claude (it is not secret) or set it yourself as the Netlify environment variable `OPENAI_APPS_CHALLENGE` and redeploy; the site then serves it at `https://zist.it.com/.well-known/openai-apps-challenge`. Click **Verify Domain**, then **Scan Tools**.
4. **Paste the annotation justifications** below when the portal asks.
5. **Record a short demo video** (see script below), upload it somewhere reviewer-accessible, and add the URL under *Review details*. (Not in the ZIP; the field is `review.demo_recording_url`.)
6. **Choose country availability** (data coverage: restaurants are Nairobi-focused; prices strongest in a few US cities). Then **Submit for review**.

No reviewer credentials are needed: the plugin has no sign-in.

## Annotation justifications (the portal asks for one per tool)
All six tools are identical in behaviour: `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`.

- **search_dishes** — Read-only: it only queries Zist's own restaurant and menu database and returns matching dishes with the restaurant; it writes nothing and sends nothing. Not destructive: nothing can be changed or deleted. Closed-world: one bounded first-party database, not the public internet. The returned `messageUrl` is a link the user opens themselves; the tool does not contact anyone. Diet and allergen filters are used only to filter and are not stored.
- **search_restaurants** — Read-only: it only queries Zist's own restaurant database and returns matching listings; it writes nothing and sends nothing. Not destructive: nothing can be changed or deleted. Closed-world: it reads one bounded first-party database, not the public internet or external entities. The returned `messageUrl` is a link the user opens themselves; the tool does not contact anyone.
- **get_restaurant** — Read-only lookup of one listing and its menu from Zist's database. No state change. Closed-world (first-party data only).
- **compare_prices** — Read-only query of community-reported prices in Zist's database. No state change. Closed-world.
- **find_deals** — Read-only query of deals stored in Zist's database. No state change. Closed-world.
- **list_requested_places** — Read-only query of place requests in Zist's database; requester identities are not returned. No state change. Closed-world.

Link clicks are logged only when a person opens `messageUrl` in a browser (a separate HTTP request to zist.it.com), never by calling a tool; this is disclosed in the privacy policy.

## Demo video script (about 2 minutes)
1. Open ChatGPT, enable the Zist plugin. Prompt: "I'm craving chicken. What can I order in Nairobi?" Show the dish, its price and declared allergen, and the allergy reminder.
2. "Show me the menu for Haandi in Westlands, Nairobi, with the allergens." Show the menu.
3. "I want the Lamb Seekh Kebabs from Haandi in Westlands, Nairobi. How do I message them?" Show the dish-specific link (no phone number); click it to show WhatsApp opening with the dish in the message.
4. "Compare milk prices in New York." Then "What does basmati rice cost in Nairobi?" Show per-store prices.
5. Negative: "Order a meal from Haandi and charge my card." Show that it declines and offers the message link.

## Before each resubmission
`npx tsx scripts/test-mcp.ts https://zist.it.com/mcp` must pass. Test cases in `plugin/plugin.json` name real data (Haandi's menu, New York milk prices, Nairobi basmati rice from Carrefour/Quickmart/Naivas); re-check them if the data changes.
