import type { NextConfig } from "next";

// No Content-Security-Policy yet: the Sumsub widget and wallet extensions inject scripts and frames it would have to list.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "geolocation=(), payment=()" },
];

const config: NextConfig = {
  // The sukuk library ships TypeScript source.
  transpilePackages: ["@tsamara/sukuk"],
  poweredByHeader: false,
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
};

export default config;
