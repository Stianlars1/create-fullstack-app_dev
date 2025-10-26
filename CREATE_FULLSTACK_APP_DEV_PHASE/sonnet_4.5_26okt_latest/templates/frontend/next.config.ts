import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',

  // Enable React strict mode
  reactStrictMode: true,

  // Enable React compiler (React 19)
  experimental: {
    reactCompiler: true,
  },

  // Environment variables exposed to browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },

  // API rewrites for development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/:path*`,
      },
    ];
  },

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },

  // Compile SCSS modules
  sassOptions: {
    silenceDeprecations: ['legacy-js-api'],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
