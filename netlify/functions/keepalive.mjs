// Keeps the free Supabase project from auto-pausing (it pauses after ~7 days with no activity).
// Runs once a day on Netlify. It makes a real, harmless database call: looking up a made-up
// invite code, which returns an empty list. Uses only the public URL + anon key the website already ships.
export default async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("keepalive: Supabase env vars missing");
    return new Response("missing env", { status: 500 });
  }
  const res = await fetch(`${url}/rest/v1/rpc/community_by_invite`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Profile": "zcm" },
    body: JSON.stringify({ c: "keepalive" }),
  });
  console.log(`keepalive: Supabase responded ${res.status}`);
  return new Response(`ok ${res.status}`, { status: res.ok ? 200 : 502 });
};

export const config = { schedule: "@daily" };
