// Keeps the free Supabase projects from auto-pausing (they pause after ~7 days with no activity).
// Runs once a day on Netlify. Each ping is a real but harmless read that touches the database, using only the
// public URL + anon key (the same ones each app already ships to browsers). Nothing is written or stored.
const targets = [
  {
    name: "zist (ZCM)",
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // look up a made-up invite code -> empty list
    request: (url) => [`${url}/rest/v1/rpc/community_by_invite`, { method: "POST", body: JSON.stringify({ c: "keepalive" }), extra: { "Content-Type": "application/json", "Content-Profile": "zcm" } }],
  },
  {
    name: "Zood",
    url: process.env.ZOOD_SUPABASE_URL,
    key: process.env.ZOOD_SUPABASE_ANON_KEY,
    // read at most one row id from a public table
    request: (url) => [`${url}/rest/v1/posts?select=id&limit=1`, { method: "GET", extra: {} }],
  },
];

export default async () => {
  const results = [];
  for (const t of targets) {
    if (!t.url || !t.key) {
      console.error(`keepalive: ${t.name}: env vars missing, skipped`);
      results.push(`${t.name}: skipped`);
      continue;
    }
    try {
      const [endpoint, { method, body, extra }] = t.request(t.url);
      const res = await fetch(endpoint, { method, body, headers: { apikey: t.key, Authorization: `Bearer ${t.key}`, ...extra } });
      console.log(`keepalive: ${t.name}: HTTP ${res.status}`);
      results.push(`${t.name}: ${res.status}`);
    } catch (err) {
      console.error(`keepalive: ${t.name}: request failed`, err);
      results.push(`${t.name}: failed`);
    }
  }
  return new Response(results.join("\n"), { status: 200 });
};

export const config = { schedule: "@daily" };
