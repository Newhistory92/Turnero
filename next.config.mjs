/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // El tótem accede al dev server por hostname de red, no por localhost.
  allowedDevOrigins: ["dos-inf-des-09"],
}

export default nextConfig
