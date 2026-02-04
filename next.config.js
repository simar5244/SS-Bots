/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
  async rewrites() {
    if (process.env.ELECTRON_BUILD === 'true') {
      return []
    }
    // Only proxy transcript-bot API to external server if explicitly enabled.
    // By default, use Next.js API routes under app/api/transcript-bot/*
    if (process.env.TRANSCRIPT_BOT_PROXY === '1') {
      return [
        {
          source: '/api/transcript-bot/:path*',
          destination: 'http://localhost:3001/api/transcript-bot/:path*',
        },
      ]
    }
    return []
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude native modules from webpack bundling on server
      config.externals = config.externals || []
      config.externals.push({
        'ssh2': 'commonjs ssh2',
      })
    }
    
    // Ignore .node files
    config.module = config.module || {}
    config.module.rules = config.module.rules || []
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    })
    
    return config
  },
}

module.exports = nextConfig
