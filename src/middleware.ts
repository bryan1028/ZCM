import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";

// Refreshes the Supabase session cookie on every request and keeps signed-out
// users away from the app. Authorization itself lives in Postgres RLS, not here.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await getUser(supabase);
  const open = ["/login", "/api/push", "/invite", "/terms", "/privacy"].some((p) => request.nextUrl.pathname.startsWith(p));
  if (!data.user && !open) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|icon-.*\\.png).*)"] };
