import type { NextConfig } from "next";

// Applied to every response. Deliberately no script-src/style-src: a strict
// CSP needs per-request nonces, which would turn every static page dynamic.
// What is here blocks clickjacking, MIME sniffing, plugin content, <base>
// hijacking and forms posting off-site, without touching how the app runs.
export const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
  },
  // Older browsers that ignore frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js": it only helps someone looking for targets.
  poweredByHeader: false,
  async headers() {
    // When two rules set the same key, the later one wins, so the service
    // worker rule stays last and keeps its own stricter CSP.
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // The service worker must never be served from a cache, or a fix to
        // it would wait for the browser's own schedule to reach anyone.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
