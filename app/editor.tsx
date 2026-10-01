import type { Restaurant } from "@/lib/types";

/** Profile + menu form shared by the owner page and the admin page. Menu is one dish per line. */
export function RestaurantEditor({ action, r, menuText, currency }: { action: (fd: FormData) => Promise<void>; r: Restaurant; menuText: string; currency: string }) {
  return (
    <form className="stack" action={action}>
      <input type="hidden" name="id" value={r.id} />
      <label className="f">Restaurant name<input type="text" name="name" defaultValue={r.name} required /></label>
      <label className="f">Address<input type="text" name="address" defaultValue={r.address ?? ""} /></label>
      <label className="f">Cuisines (comma separated)<input type="text" name="cuisines" defaultValue={r.cuisines.join(", ")} placeholder="pizza, italian" /></label>
      <label className="f">WhatsApp for orders (with country code)<input type="tel" name="whatsapp" defaultValue={r.whatsapp ? `+${r.whatsapp}` : ""} /></label>
      <label className="f">Phone (if different)<input type="tel" name="phone" defaultValue={r.phone ? `+${r.phone}` : ""} /></label>
      <label className="f">Website<input type="url" name="site" defaultValue={r.website ?? ""} placeholder="https://" /></label>
      <label className="f">Currency (3 letters)<input type="text" name="currency" defaultValue={currency} maxLength={3} style={{ textTransform: "uppercase", maxWidth: 100 }} /></label>
      <label className="f">Menu, one dish per line
        <textarea name="menu" rows={12} defaultValue={menuText} placeholder={"Margherita | 12.5 | Tomato, mozzarella, basil | vegetarian | dairy,gluten\nHouse salad | 7 | | vegan"} style={{ fontFamily: "monospace" }} />
      </label>
      <p className="meta">Format: <code>Name | price | description | diets | allergens it contains</code>. Only the name is required. Diets: vegan, vegetarian, gluten_free, halal, kosher, dairy_free, nut_free. Allergens are what the dish <b>contains</b>; leave empty if you haven't checked.</p>
      <button type="submit">Save</button>
    </form>
  );
}
