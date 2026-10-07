import { safeNext } from "@/lib/nav";
import LoginForm from "./login-form";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; email?: string; step?: string }> }) {
  const { next, error, email, step } = await searchParams;
  return (
    <>
      <h1>Zist Community Marketplace</h1>
      <p className="muted">A closed marketplace for residents only. Sign in with your email to get started.</p>
      <LoginForm next={safeNext(next)} initialError={error} initialEmail={email} initialStep={step === "code" && email ? "code" : "email"} />
    </>
  );
}
