import { NextResponse, type NextRequest } from "next/server";

/** HTTP Basic auth for /admin. Username "admin", password from ADMIN_PASSWORD. */
export function proxy(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    // Fail closed in production; allow locally so the demo is easy to try.
    if (process.env.NODE_ENV === "production") return new NextResponse("Admin disabled: set ADMIN_PASSWORD", { status: 503 });
    return NextResponse.next();
  }
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const [user, ...rest] = atob(header.slice(6)).split(":");
    if (user === "admin" && rest.join(":") === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Zist admin"' } });
}

export const config = { matcher: ["/admin/:path*"] };
