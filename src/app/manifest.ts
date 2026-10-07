import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zist Community Marketplace",
    short_name: "Zist",
    description: "A closed marketplace for your estate",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8f5",
    theme_color: "#2f7d4f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
