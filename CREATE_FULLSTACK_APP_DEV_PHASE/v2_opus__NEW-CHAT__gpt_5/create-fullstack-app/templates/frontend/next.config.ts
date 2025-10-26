import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    reactCompiler: true,
  },
  //typedRoutes: true,
};

export default nextConfig;
