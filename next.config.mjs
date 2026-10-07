export default {
  // photos / payment screenshots are posted through server actions (bucket limit is 5 MB each)
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};
