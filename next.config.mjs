/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // No-store on document / app / API responses so the FileMaker Web Viewer
        // (and any browser) never serves a stale cached page. Immutable hashed
        // assets under /_next/static are excluded — they must stay cacheable for
        // performance and are safe to cache (their URL changes on every build).
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};
export default nextConfig;
