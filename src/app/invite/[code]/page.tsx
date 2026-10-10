import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Page from "@/components/page";
import { getUser } from "@/lib/auth";

// Public landing page for an invite link: shows only the community name.
export default async function Invite({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { code } = await params;
  const { ref } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("community_by_invite", { c: code });
  const community = data?.[0];
  if (!community) {
    return (
      <Page>
        <div className="card center">
          <div style={{ fontSize: 36 }} aria-hidden>🔗</div>
          <h2 style={{ marginTop: 6 }}>This invite link isn&apos;t valid any more</h2>
          <p className="muted">Ask a neighbour or your community admin for a fresh one.</p>
        </div>
      </Page>
    );
  }

  const joinPath = `/join?code=${encodeURIComponent(code)}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`;
  const { data: { user } } = await getUser(supabase);
  if (user) redirect(joinPath);

  return (
    <Page>
      <div className="card accent stack">
        <span className="badge brand" style={{ justifySelf: "start" }}>You&apos;re invited</span>
        <h1>Join {community.name}</h1>
        <p style={{ margin: 0 }}>
          {ref ? <>@{ref} thinks you&apos;ll like it. </> : null}
          A private marketplace for residents: trusted services (gardeners, cleaners, repairs) and things your neighbours make and sell.
        </p>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Everyone is verified as a real resident</li>
          <li>Message neighbours directly, with reviews you can trust</li>
        </ul>
        <Link href={`/login?next=${encodeURIComponent(joinPath)}`} className="btn">Sign in to join</Link>
      </div>
    </Page>
  );
}
