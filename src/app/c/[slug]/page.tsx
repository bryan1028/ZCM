import { redirect } from "next/navigation";

export default async function CommunityHome({ params }: { params: Promise<{ slug: string }> }) {
  redirect(`/c/${(await params).slug}/services`);
}
