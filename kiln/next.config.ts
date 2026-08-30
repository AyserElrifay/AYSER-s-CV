import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // The money module and the RLS client are server-only. Bundling either into
  // a client chunk would be a data leak, not a build error, so fail loudly.
  serverExternalPackages: ['postgres'],
};

export default config;
