const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },                                   // nobody can embed the app in a frame (clickjacking)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },          // don't leak full URLs (e.g. invite codes) to other sites
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

export default {
  // photos / payment screenshots are posted through server actions (bucket limit is 5 MB each)
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
