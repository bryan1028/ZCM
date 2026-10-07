import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// "Download my data": everything tied to the signed-in person, as one JSON file.
// Uses the person's own session, so database rules guarantee they only get what they're allowed to see.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const sellerIds = ((await supabase.from("sellers").select("id").eq("user_id", user.id)).data ?? []).map((s) => s.id);
  const [profile, memberships, sellers, listings, reviews, reservations, messages, notifications, reports] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id),
    supabase.from("memberships").select("*").eq("user_id", user.id),
    supabase.from("sellers").select("*").eq("user_id", user.id),
    sellerIds.length ? supabase.from("listings").select("*").in("seller_id", sellerIds) : Promise.resolve({ data: [] }),
    supabase.from("reviews").select("*").eq("reviewer_id", user.id),
    supabase.from("reservations").select("*, payments(*)").or(`buyer_id.eq.${user.id},seller_user_id.eq.${user.id}`),
    supabase.from("messages").select("*").eq("sender_id", user.id),
    supabase.from("notifications").select("*").eq("user_id", user.id),
    supabase.from("reports").select("*").eq("reporter_id", user.id),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile: profile.data, memberships: memberships.data, seller_profiles: sellers.data, listings: listings.data,
    reviews_i_wrote: reviews.data, orders: reservations.data, messages_i_sent: messages.data,
    notifications: notifications.data, reports_i_made: reports.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="my-zist-data.json"', "Cache-Control": "no-store" },
  });
}
