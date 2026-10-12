import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/brand';
import {
  getSoftwareApplicationJsonLd,
  getWebsiteJsonLd,
  toJsonLdScript
} from '@/lib/json-ld';
import { getSiteOgImageUrl, siteUrl } from '@/lib/site';

import './global.css';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap'
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap'
});

const SITE_TITLE = SITE_NAME;
const SITE_IMAGE = getSiteOgImageUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_TITLE}`
  },
  description: SITE_DESCRIPTION,
  applicationName: 'Tsamara Docs',
  appleWebApp: {
    title: 'Tsamara Docs'
  },
  other: {
    'msapplication-TileColor': '#ffffff'
  },
  icons: {
    icon: [
      { url: '/favicon/favicon.ico' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' }
    ],
    apple: [{ url: '/favicon/apple-touch-icon.png', sizes: '180x180' }]
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: SITE_TITLE,
    url: siteUrl,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SITE_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Tsamara'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SITE_IMAGE,
        alt: 'Tsamara'
      }
    ]
  },
  alternates: {
    canonical: siteUrl
  }
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html
      lang="en-US"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload
          dangerouslySetInnerHTML={toJsonLdScript([
            getWebsiteJsonLd(),
            getSoftwareApplicationJsonLd()
          ])}
        />
      </head>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <RootProvider dir="ltr">{children}</RootProvider>
      </body>
    </html>
  );
};

export default RootLayout;
