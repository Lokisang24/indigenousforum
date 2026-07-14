/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The certificate PDF generator reads image files (like lib/indigenous.jpg)
  // from disk at runtime using a computed path. Vercel's automatic file
  // tracing doesn't always detect that pattern, so we explicitly guarantee
  // these files are bundled with every serverless function that needs them.
  experimental: {
    outputFileTracingIncludes: {
      "/api/admin/applications/[id]/certificate": ["./lib/*.jpg"],
      "/api/**": ["./lib/*.jpg"],
    },
  },
};

module.exports = nextConfig;
