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

// The reference uses Gellix, a commercial typeface; Figtree is the closest open one.
const font = Figtree({ subsets: ["latin"], variable: "--font" });

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
