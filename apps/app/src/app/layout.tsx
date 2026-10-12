import { existsSync } from "node:fs";
import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { Providers } from "@/components/store";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tsamara app", template: "%s · Tsamara" },
  description:
    "A devnet prototype: subscribe to, hold and transfer units of a mock sukuk series. Not an offer of securities.",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  openGraph: { siteName: "Tsamara", images: ["https://tsamara.xyz/og.png"] },
  twitter: { card: "summary_large_image" },
};

// The reference uses Gellix, a commercial typeface; Figtree is the closest open one and the default.
const font = Figtree({ subsets: ["latin"], variable: "--font" });

// Gellix is used when licensed files have been placed in public/fonts/gellix (see the README there).
// Checked at build time, so a build without the files never asks a browser to fetch them.
const GELLIX = { Regular: 400, Medium: 500, SemiBold: 600, Bold: 700 };
const gellixFaces = existsSync("public/fonts/gellix/Gellix-Regular.woff2")
  ? Object.entries(GELLIX)
      .map(
        ([name, weight]) =>
          `@font-face{font-family:Gellix;font-weight:${weight};font-display:swap;src:url(/fonts/gellix/Gellix-${name}.woff2) format("woff2")}`,
      )
      .join("")
  : "";

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      {gellixFaces && (
        <head>
          <style>{gellixFaces}</style>
        </head>
      )}
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
