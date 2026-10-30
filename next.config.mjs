/** @type {import('next').NextConfig} */
const nextConfig = {
  // For local development, basePath is '/'
  // This file will be overwritten during deployment with the appropriate basePath
  images: {},
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/admin.external-event-register/:path*',
        destination: '/event-registration/:path*',
        permanent: true,
      },
    ];
  },
  // Allow production build to complete while ESLint issues are fixed (run `npm run lint` separately).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
