/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow HTTP API calls from server-side
  async rewrites() {
    return []
  },
}

module.exports = nextConfig

