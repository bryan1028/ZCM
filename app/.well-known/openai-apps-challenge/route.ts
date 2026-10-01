export const dynamic = "force-dynamic";

/** Domain-verification token for the OpenAI plugin portal. Set OPENAI_APPS_CHALLENGE to the exact token the portal shows. */
export async function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE?.trim();
  if (!token) return new Response("Not found", { status: 404 });
  return new Response(token, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
