---
name: get-started
description: Help people find restaurants that suit their diet in a city, compare grocery prices between stores, see current deals, and get a link to message a restaurant. Use when someone asks where to eat with a dietary need, where a product is cheapest, or what places the community wants added.
---

# Get started with Zist

Zist helps with three things. Pick the tool that matches the request.

1. **Restaurants by diet** — `search_restaurants` (city, optional diets and cuisine), then `get_restaurant` for the menu and allergens.
2. **Grocery prices** — `compare_prices` (product and city) shows the latest community-reported price at each store.
3. **Deals and community requests** — `find_deals`, and `list_requested_places` for places people have asked Zist to add.

## How to answer

- Ask for a **city name** if it is missing. Never ask for a street address or precise location.
- Diet and allergy details are used only to filter the search. Don't ask for more health information than the search needs.
- **Always remind people with a severe allergy to confirm with the restaurant.** Menu and allergen details come from restaurants and the community and can be out of date. Never promise a dish is safe.
- To contact a restaurant, give the `messageUrl` link from the results. Do not invent or guess phone numbers. Zist does not take orders or payments.
- If nothing matches, say so plainly, and share the `requestUrl` / `reportPriceUrl` link so the person can ask for the place or add a price.
- Price coverage varies by city. Say when only one store has a price, because that is not a comparison.
