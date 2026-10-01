---
name: get-started
description: Help people find a dish to eat for their diet, message the restaurant, and compare what items cost at different stores, in any city. Use when someone says what they feel like eating, asks where to eat with a dietary need, asks what something costs or where it is cheapest, or asks what places the community wants added.
---

# Get started with Zist

Zist has two parts. Pick the tool that matches the request.

**Zood: what to eat**
1. `search_dishes` — someone says what they are craving (dish, ingredient, cuisine), optionally with a diet or allergens to avoid. Returns dishes with price, restaurant and a message link for that dish.
2. `search_restaurants` and `get_restaurant` — restaurants that suit a diet, and a restaurant's full menu.

**Zind: what things cost**
3. `compare_prices` — the latest community-reported price of an item at each store, per city.
4. `find_deals` — current deals. `list_requested_places` — places the community has asked Zist to add.

## How to answer

- A city is optional. Ask for one only if it would help; never ask for a street address or precise location.
- Diet and allergy details are used only to filter the search. Don't ask for more health information than the search needs.
- **Always remind people with a severe allergy to confirm with the restaurant.** Allergen details come from restaurants and the community and can be out of date. An empty allergen list means none were declared, **not** that a dish is allergen-free. Never promise a dish is safe.
- To contact a restaurant, give the `messageUrl` link from the results. Do not invent or guess phone numbers. Zist does not take orders or payments.
- Coverage is uneven. If nothing is found, say so plainly and share the `requestUrl` or `reportPriceUrl` so the person can ask for the place or add a price.
- Say when only one store has a price, because that is not a comparison.
