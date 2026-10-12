import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { Providers } from "@/components/store";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tsamara app", template: "%s · Tsamara" },
  description: "Subscribe to, hold and transfer tokenized sovereign sukuk. Devnet prototype.",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  openGraph: { siteName: "Tsamara", images: ["https://tsamara.xyz/og.png"] },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
