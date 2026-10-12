import type { NextConfig } from 'next';

import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  reactCompiler: true,
  serverExternalPackages: ['@takumi-rs/core'],
  images: {
    qualities: [75, 90]
  },
  experimental: {
    useTypeScriptCli: true,
    optimizePackageImports: ['@gravity-ui/icons']
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*.md',
        destination: '/llms.mdx/docs/:path*'
      }
    ];
  },
  // Readers come for the docs; the root and /docs both land on the first page.
  redirects: async () => [
    {
      source: '/',
      destination: '/docs/introduction',
      permanent: true
    },
    {
      source: '/docs',
      destination: '/docs/introduction',
      permanent: true
    }
  ]
};

export default withMDX(config);
