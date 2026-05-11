import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Disable Turbopack via config instead of CLI flag
  turbopack: {
    // Empty object - disables advanced features
  },
}

export default nextConfig