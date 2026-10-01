"use client";

import { useEffect, useRef } from "react";

declare global { interface Window { grecaptcha?: { ready(cb: () => void): void; execute(key: string, o: { action: string }): Promise<string> } } }

/** reCAPTCHA v3: invisible and score-based. Fetches a token as the page loads and refreshes it before it expires. */
export default function CaptchaClient({ siteKey, action }: { siteKey: string; action: string }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let stop = false;
    const run = () => window.grecaptcha?.ready(() => {
      window.grecaptcha!.execute(siteKey, { action }).then((t) => { if (!stop && input.current) input.current.value = t; }).catch(() => {});
    });
    const id = "recaptcha-v3";
    if (!document.getElementById(id)) {
      const s = document.createElement("script");
      s.id = id; s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`; s.async = true; s.onload = run;
      document.head.appendChild(s);
    } else run();
    const t = setInterval(run, 90_000); // tokens last 2 minutes
    return () => { stop = true; clearInterval(t); };
  }, [siteKey, action]);
  return (
    <>
      <input type="hidden" name="g-recaptcha-response" ref={input} />
      <p className="meta" style={{ fontSize: 12 }}>Protected by reCAPTCHA. Google's <a href="https://policies.google.com/privacy">Privacy Policy</a> and <a href="https://policies.google.com/terms">Terms</a> apply.</p>
    </>
  );
}
