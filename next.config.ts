import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  allowedDevOrigins: [
    "172.25.176.1",
    "localhost",
    "127.0.0.1",
    "192.168.0.120",
    "192.168.137.1",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
