import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next.js Image Optimization to load images from Supabase Storage.
  // Private bucket (product-images) uses signed URLs served from this origin.
  // Public buckets in this project would use the same origin with /public/ in path.
  // Data URLs (data:image/...) are intentionally NOT listed — they cannot be
  // optimized by Next/Image and are handled by raw <img> with eslint-disable.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pdmcobvoabsrrqarayxs.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;
