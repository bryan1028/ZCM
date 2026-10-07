import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/nav";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(new URL(safeNext(request.cookies.get("zcm_next")?.value), request.url));
      res.cookies.delete("zcm_next");
      return res;
    }
  }
  return NextResponse.redirect(new URL("/login?error=Link%20expired%2C%20try%20again", request.url));
}
