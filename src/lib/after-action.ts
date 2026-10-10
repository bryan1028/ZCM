import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Finish a successful server action by refreshing the page the person is already on, inside the same response.
 * `redirect()` would add a second full request (middleware, layout and page all run again) before anything changes
 * on screen, which is the slow part when the server and database are far apart.
 * If the current URL carries a one-off message (?error=…, ?saved=1), we do navigate so the message is cleared.
 */
export async function done(back: string) {
  const referer = (await headers()).get("referer") ?? "";
  if (/[?&](error|saved|reported|new)=/.test(referer)) redirect(back);
  revalidatePath(back.split("?")[0]);
}
