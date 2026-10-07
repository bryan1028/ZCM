import Link from "next/link";
import { safeNext } from "@/lib/nav";
import Page from "@/components/page";
import LoginForm from "./login-form";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; email?: string; step?: string; goodbye?: string }> }) {
  const { next, error, email, step, goodbye } = await searchParams;
  return (
    <Page>
      <h1>Welcome 👋</h1>
      <p className="muted" style={{ margin: "6px 0 18px", fontSize: 16 }}>
        Trusted services and local goods from your verified neighbours. Sign in with your email, no password needed.
      </p>
      {goodbye && <div className="alert ok" role="status" style={{ marginBottom: 12 }}>Your account has been deleted. Sorry to see you go.</div>}
      <LoginForm next={safeNext(next)} initialError={error} initialEmail={email} initialStep={step === "code" && email ? "code" : "email"} />
      <p className="muted small center" style={{ marginTop: 18 }}>A closed marketplace: residents only, verified by your community admin.<br />By continuing you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
    </Page>
  );
}
