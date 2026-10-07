"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";

const RESEND_SECONDS = 45;

function Submit({ idle, busy, secondary, disabled }: { idle: string; busy: string; secondary?: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={secondary ? "secondary" : undefined} disabled={pending || disabled} aria-busy={pending}>
      {pending ? busy : idle}
    </button>
  );
}

export default function LoginForm({ next, initialError, initialEmail, initialStep = "email" }: {
  next: string; initialError?: string; initialEmail?: string; initialStep?: "email" | "code";
}) {
  const [state, act] = useActionState<LoginState, FormData>(loginAction, {
    step: initialStep, email: initialEmail ?? "", name: "", next, error: initialError,
  });
  const [cooldown, setCooldown] = useState(0);

  // restart the resend timer each time a code goes out successfully
  useEffect(() => {
    if (state.step === "code" && state.notice && !state.error) setCooldown(RESEND_SECONDS);
  }, [state]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const hidden = (
    <>
      <input type="hidden" name="email" value={state.email} />
      <input type="hidden" name="name" value={state.name} />
      <input type="hidden" name="next" value={state.next} />
    </>
  );

  if (state.step === "code") {
    return (
      <>
        <div className="card accent" role="status" aria-live="polite" style={{ marginBottom: 14 }}>
          <strong>✉️ Check your email</strong>
          <p style={{ margin: "6px 0 0" }} className="muted">
            {state.notice ?? `Enter the 6-digit code we sent to ${state.email}.`}
          </p>
        </div>

        <form action={act} className="card stack">
          {hidden}
          <input type="hidden" name="intent" value="verify" />
          <label>
            6-digit code
            <input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8}
              placeholder="123456" required autoFocus className="kbd-code" />
          </label>
          <Submit idle="Sign in" busy="Checking…" />
          {state.error && <div role="alert" className="alert error">{state.error}</div>}
        </form>

        <form action={act} className="inline-form" style={{ marginTop: 12 }}>
          {hidden}
          <input type="hidden" name="intent" value="send" />
          <input type="hidden" name="resend" value="1" />
          <Submit secondary idle={cooldown > 0 ? `Send a new code (${cooldown}s)` : "Send a new code"} busy="Sending…" disabled={cooldown > 0} />
          <a href={`/login?next=${encodeURIComponent(state.next)}`} className="muted small">Use a different email</a>
        </form>
      </>
    );
  }

  return (
    <>
      {state.error && <div className="alert error" role="alert" style={{ marginBottom: 12 }}>{state.error}</div>}
      <form action={act} className="card stack">
        <input type="hidden" name="intent" value="send" />
        <input type="hidden" name="next" value={state.next} />
        <label>Your name<input name="name" placeholder="Jane Wanjiku" defaultValue={state.name} autoComplete="name" /></label>
        <label>Email<input name="email" type="email" required defaultValue={state.email} autoComplete="email" /></label>
        <Submit idle="Email me a sign-in code" busy="Sending code…" />
        <p className="muted small" style={{ margin: 0 }}>We&apos;ll email you a 6-digit code. It takes a few seconds.</p>
      </form>
    </>
  );
}
