import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.broadage.com',
        pathname: '/images-teams/**',
      },
      {
        protocol: 'https',
        hostname: 'www.iddaa.com',
        pathname: '/images/**',
      },
    ],
  },
};

export default nextConfig;
