"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Refreshes the server-rendered thread whenever a new message arrives (Supabase Realtime, filtered by RLS).
// A slow poll covers dropped sockets.
export default function Live({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "zcm", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => router.refresh())
      .subscribe();
    const poll = setInterval(() => router.refresh(), 30000);
    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, [conversationId, router]);
  return null;
}
