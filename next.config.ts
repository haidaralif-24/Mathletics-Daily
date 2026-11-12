import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Server Action bodies default to 1 MB, but the admin question editor
      // uploads an image of up to 8 MB through an action (lib/config.ts
      // LIMITS.stepPhotoMaxBytes). Leaves room for multipart overhead.
      // Member step photos do NOT come through here: the browser uploads them
      // straight to the submission-media bucket and only paths are submitted.
      bodySizeLimit: '10mb',
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
