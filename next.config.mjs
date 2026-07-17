/** @type {import('next').NextConfig} */
// Cache-Control: no-store is stamped on every gated response by middleware.ts
// (a single choke point that also covers the 307 redirect + 401 denied page).
// Immutable /_next/static assets are excluded by the middleware matcher and keep
// their long-lived cache.
const nextConfig = { reactStrictMode: true };
export default nextConfig;
