/** Connects to a running MCP endpoint like ChatGPT would and checks the contract. Usage: tsx scripts/test-mcp.ts http://localhost:3000/mcp */
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.argv[2] ?? "http://localhost:3000/mcp";
const client = new Client({ name: "zist-test", version: "0.0.0" });
const call = async (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args }) as Promise<{ isError?: boolean; structuredContent?: Record<string, any>; content: { type: string; text: string }[] }>;
const ok = (m: string) => console.log("PASS", m);

(async () => {
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  const info = client.getServerVersion(); assert.equal(info?.name, "zist"); ok(`initialize (${info?.name} ${info?.version})`);
  const instr = client.getInstructions() ?? ""; assert.ok(instr.length > 50 && instr.length < 1500); ok(`instructions present (${instr.length} chars; key point in first 512: ${/allerg/i.test(instr.slice(0, 512))})`);

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ["compare_prices", "find_deals", "get_restaurant", "list_requested_places", "search_restaurants"]);
  for (const t of tools) {
    assert.equal(t.annotations?.readOnlyHint, true, `${t.name} readOnlyHint`);
    assert.equal(t.annotations?.destructiveHint, false, `${t.name} destructiveHint`);
    assert.equal(t.annotations?.openWorldHint, false, `${t.name} openWorldHint`);
    assert.ok(t.description && t.description.startsWith("Use this when"), `${t.name} description`);
    assert.ok(t.outputSchema, `${t.name} outputSchema`);
  }
  ok(`5 tools, all readOnly/non-destructive/closed-world, with descriptions + output schemas`);

  const s = await call("search_restaurants", { city: "Nairobi", diets: ["vegetarian"] });
  assert.ok(!s.isError); const rs = s.structuredContent!.results as any[]; assert.ok(rs.length >= 1);
  assert.ok(rs.every((r) => r.diets.includes("vegetarian"))); ok(`search_restaurants vegetarian Nairobi -> ${rs.map((r) => r.name).join(", ")}`);
  const withMsg = rs.find((r) => r.messageUrl); assert.ok(withMsg?.messageUrl.includes("/go/") && withMsg.messageUrl.includes("src=chatgpt")); ok("messageUrl is a tracked /go link with src=chatgpt");
  assert.ok(!JSON.stringify(s.structuredContent).match(/\b254\d{9}\b|wa\.me/), "no raw phone numbers"); ok("no raw phone numbers in output");
  assert.match(s.content[0].text, /confirm with the restaurant/i); assert.match(s.content[0].text, /empty allergen list means none were declared/i); ok("text includes allergy disclaimer");

  const g = await call("get_restaurant", { id: rs[0].id }); assert.equal(g.structuredContent!.found, true); ok(`get_restaurant -> ${g.structuredContent!.restaurant.name} (${g.structuredContent!.restaurant.menu.length} items)`);
  const g2 = await call("get_restaurant", { id: "does-not-exist" }); assert.equal(g2.structuredContent!.found, false); ok("get_restaurant unknown id -> found:false, no error");

  const p = await call("compare_prices", { product: "milk", city: "Nairobi" }); assert.ok(!p.isError); ok(`compare_prices -> ${(p.structuredContent!.comparisons as any[]).length} product(s)`);
  const d = await call("find_deals", { city: "Nairobi" }); assert.ok(!d.isError); ok(`find_deals -> ${(d.structuredContent!.deals as any[]).length} deal(s)`);
  const q = await call("list_requested_places", { city: "Nairobi" }); assert.ok(!q.isError); assert.ok(!JSON.stringify(q.structuredContent).includes("handle")); ok(`list_requested_places -> ${(q.structuredContent!.requests as any[]).length} request(s), no handles exposed`);
  const e = await call("search_restaurants", { city: "Nairobi", limit: 99 }).catch((x) => ({ isError: true, content: [{ text: String(x.message) }] })); assert.ok((e as any).isError); ok("limit=99 rejected (input validation)");
  const e2 = await call("search_restaurants", { city: "Nairobi", diets: ["keto"] }).catch((x) => ({ isError: true, content: [{ text: String(x.message) }] })); assert.ok((e2 as any).isError); ok("unknown diet rejected");
  const e3 = await call("search_restaurants", {}).catch((x) => ({ isError: true, content: [{ text: String(x.message) }] })); assert.ok((e3 as any).isError); ok("missing city rejected");
  const none = await call("search_restaurants", { city: "Atlantis" }); assert.equal((none.structuredContent!.results as any[]).length, 0); ok("unknown city -> empty results with a helpful message");
  await client.close(); console.log("\nMCP contract: all checks passed");
})().catch((e) => { console.error("MCP TEST FAILED:", e.message); process.exit(1); });
