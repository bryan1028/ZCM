import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Public landing page for an invite link: shows only the community name.
export default async function Invite({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { code } = await params;
  const { ref } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("community_by_invite", { c: code });
  const community = data?.[0];
  if (!community) return <div className="card"><strong>This invite link isn&apos;t valid any more.</strong><p className="muted">Ask a neighbour or your community admin for a fresh one.</p></div>;

  const joinPath = `/join?code=${encodeURIComponent(code)}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(joinPath);

  return (
    <>
      <h1>You&apos;re invited to {community.name}</h1>
      <p>{ref ? <>@{ref} thinks you&apos;ll like it. </> : null}A private marketplace for residents: trusted services (gardeners, cleaners, repairs) and things your neighbours make and sell.</p>
      <p className="muted">Everyone is verified as a real resident before they can see anything.</p>
      <Link href={`/login?next=${encodeURIComponent(joinPath)}`}><button type="button" style={{ width: "100%" }}>Sign in to join</button></Link>
    </>
  );
}
