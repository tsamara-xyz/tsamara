// Next.js injects its own Buffer polyfill into browser bundles, and that one predates the 64-bit
// methods @solana/spl-token uses to build transfer-hook instructions. Borrow them from buffer@6.
// The trailing slash imports the npm package rather than Next's built-in alias.
import { Buffer as NpmBuffer } from "buffer/";

const METHODS = [
  "readBigUInt64LE",
  "readBigUInt64BE",
  "readBigInt64LE",
  "readBigInt64BE",
  "writeBigUInt64LE",
  "writeBigUInt64BE",
  "writeBigInt64LE",
  "writeBigInt64BE",
] as const;

const target = Buffer.prototype as unknown as Record<string, unknown>;
const source = NpmBuffer.prototype as unknown as Record<string, unknown>;
for (const method of METHODS) target[method] ??= source[method];

globalThis.Buffer ??= Buffer;
