/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from supabase storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
  // Transpile Three.js correctly on Windows
  transpilePackages: ['three'],
  // Allow building with missing env vars (dev mode)
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
