import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fortnite-tournament-objects.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "fortnite-tournament-objects.s3.us-east-1.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
