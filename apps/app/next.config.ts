import type { NextConfig } from "next";

const config: NextConfig = {
  // The sukuk library ships TypeScript source.
  transpilePackages: ["@tsamara/sukuk"],
};

export default config;
