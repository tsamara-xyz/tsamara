import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // @solana/web3.js and spl-token expect Node's `global`.
  define: { global: "globalThis" },
});
