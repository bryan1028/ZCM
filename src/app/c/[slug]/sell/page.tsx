import { createClient } from "@/lib/supabase/server";
import SellForm from "./sell-form";

export default async function Sell({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: seller } = await supabase.from("sellers").select("id, communities!inner(slug)").eq("communities.slug", slug).eq("user_id", user!.id).maybeSingle();

  return (
    <div className="page-narrow">
      <div className="page-head"><div><h1>Sell or offer something</h1><p className="muted">It takes a minute. You can add photos right after.</p></div></div>
      {error && <div className="alert error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <SellForm slug={slug} hasSeller={!!seller} />
    </div>
  );
}
