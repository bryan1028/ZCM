/** The homepage "pinboard": one iconic dish per place. Photos are openly licensed (Wikimedia Commons); credits live on /about#credits. */
export interface Pin {
  key: string;
  dish: string;
  place: string;
  city: string;
  q: string;
  emoji: string;
  color: string;
  shape: "tall" | "sq" | "wide";
  /** Local file in /public/img/pins; absent until a photo is chosen. */
  img?: string;
  alt: string;
  credit?: { title: string; author: string; license: string; url: string };
}

export const PINS: Pin[] = [
  { key: "pizza", dish: "Pizza", place: "Little Italy, New York", city: "New York", q: "pizza", emoji: "🍕", color: "#e8531a", shape: "tall", img: "/img/pins/pizza.jpg", alt: "A margherita pizza", credit: { title: "Pizza-napoletana.jpg", author: "Fabryx98", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Pizza-napoletana.jpg" } },
  { key: "burger", dish: "Burger", place: "London", city: "London", q: "burger", emoji: "🍔", color: "#b8741a", shape: "sq", img: "/img/pins/burger.jpg", alt: "A cheeseburger", credit: { title: "Cheeseburger.jpg", author: "Renee Comet (photographer)", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Cheeseburger.jpg" } },
  { key: "sushi", dish: "Sushi", place: "Tokyo, Japan", city: "Tokyo", q: "sushi", emoji: "🍣", color: "#d6286a", shape: "wide", img: "/img/pins/sushi.jpg", alt: "A plate of nigiri sushi", credit: { title: "Shichifuku Nigiri Sushi at Tsukiji Tamasushi, Wing Takana…", author: "N509FZ", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Shichifuku_Nigiri_Sushi_at_Tsukiji_Tamasushi%2C_Wing_Takanawa_%2820230802203124%29.jpg" } },
  { key: "noodles", dish: "Jajangmyeon", place: "Seoul, Korea", city: "Seoul", q: "noodles", emoji: "🍜", color: "#6b3a1a", shape: "tall", img: "/img/pins/noodles.jpg", alt: "Korean black bean noodles", credit: { title: "Jajangmyeon by KFoodaddict.jpg", author: "KFoodaddict", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:Jajangmyeon_by_KFoodaddict.jpg" } },
  { key: "egusi", dish: "Egusi soup", place: "Lagos, Nigeria", city: "Lagos", q: "egusi", emoji: "🥘", color: "#1b7a43", shape: "sq", img: "/img/pins/egusi.jpg", alt: "A bowl of egusi soup", credit: { title: "Egusi soup with pounded yam and assorted meats.jpg", author: "Onyenachi64", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Egusi_soup_with_pounded_yam_and_assorted_meats.jpg" } },
  { key: "chai", dish: "Masala chai", place: "Mumbai, India", city: "Mumbai", q: "chai", emoji: "🍵", color: "#a8571a", shape: "wide", img: "/img/pins/chai.jpg", alt: "Masala chai being served", credit: { title: "Masala Chai.JPG", author: "Miansari66", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Masala_Chai.JPG" } },
  { key: "chapati", dish: "Chapati", place: "Nairobi, Kenya", city: "Nairobi", q: "chapati", emoji: "🫓", color: "#c98a1a", shape: "sq", img: "/img/pins/chapati.jpg", alt: "Chapati flatbreads", credit: { title: "Chapati kenya.jpg", author: "safaritravelplus", license: "CC0", url: "https://commons.wikimedia.org/wiki/File:Chapati_kenya.jpg" } },
];
