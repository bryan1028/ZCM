import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Spreadsheet-safe CSV cell: quote it, and neutralise leading = + - @ so Excel/Sheets never run user text as a formula. */
function cell(v: unknown): string {
  let s = Array.isArray(v) ? v.join("; ") : String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const type = req.nextUrl.searchParams.get("type");
  const store = getStore();
  let body: string, name: string;

  if (type === "users") {
    // Marketing list: ONLY people who ticked the opt-in box.
    const ps = (await store.listProfiles(20000)).filter((p) => p.optIn && p.email);
    body = csv([["email", "username", "city", "country", "diets", "signed_up"], ...ps.map((p) => [p.email, p.username, p.city, p.country, p.diets, p.createdAt.slice(0, 10)])]);
    name = "zist-optin-users.csv";
  } else if (type === "requests") {
    const rs = await store.listRequests({ includeAll: true, limit: 5000 });
    body = csv([["kind", "name", "city", "country", "backers", "requested_by", "whatsapp", "website", "status", "created"],
      ...rs.map((r) => [r.kind, r.name, r.city, r.country, r.supportCount, r.createdBy.handle, r.whatsapp ?? "", r.website ?? "", r.status, r.createdAt.slice(0, 10)])]);
    name = "zist-requests.csv";
  } else {
    return NextResponse.json({ error: "type must be users or requests" }, { status: 400 });
  }
  return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
