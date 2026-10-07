import { safeNext } from "@/lib/nav";
import Page from "@/components/page";
import LoginForm from "./login-form";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; email?: string; step?: string }> }) {
  const { next, error, email, step } = await searchParams;
  return (
    <Page>
      <h1>Welcome 👋</h1>
      <p className="muted" style={{ margin: "6px 0 18px", fontSize: 16 }}>
        Trusted services and local goods from your verified neighbours. Sign in with your email, no password needed.
      </p>
      <LoginForm next={safeNext(next)} initialError={error} initialEmail={email} initialStep={step === "code" && email ? "code" : "email"} />
      <p className="muted small center" style={{ marginTop: 18 }}>A closed marketplace: residents only, verified by your community admin.</p>
    </Page>
  );
}
