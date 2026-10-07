"use client";
import { useEffect, useRef } from "react";

// Keeps the newest message in view. Rendered with a key that changes as messages arrive, so it re-runs.
export default function ScrollEnd() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: "end" }); }, []);
  return <div ref={ref} aria-hidden />;
}
