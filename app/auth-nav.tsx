"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { logOut } from "./auth-actions";

export function AuthNav() {
  const [handle, setHandle] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).then((d) => live && setHandle(d.handle ?? null)).catch(() => live && setHandle(null));
    return () => { live = false; };
  }, []);

  if (handle === undefined) return <span className="auth-slot" aria-hidden />;
  if (!handle) return <Link href="/login" className="auth-link">Sign in</Link>;
  return (
    <span className="auth-slot">
      <Link href="/account" className="auth-link">@{handle}</Link>
      <form action={logOut} className="inline"><button type="submit" className="linklike">Sign out</button></form>
    </span>
  );
}
