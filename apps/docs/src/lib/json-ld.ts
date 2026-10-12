import {
  GITHUB_URL,
  LANDING_URL,
  PRODUCT_NAME,
  SHORT_DESCRIPTION,
  SITE_NAME
} from '@/lib/brand';
import { getCanonicalUrl, siteUrl } from '@/lib/site';

type JsonLd = Record<string, unknown>;

const publisher = {
  '@type': 'Organization',
  name: PRODUCT_NAME,
  url: LANDING_URL,
  sameAs: [GITHUB_URL]
};

export const toJsonLdScript = (data: JsonLd | JsonLd[]) => {
  return {
    __html: JSON.stringify(data)
  };
};

export const getWebsiteJsonLd = (): JsonLd => {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: siteUrl,
    description: SHORT_DESCRIPTION,
    publisher
  };
};

export const getSoftwareApplicationJsonLd = (): JsonLd => {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: PRODUCT_NAME,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    url: LANDING_URL,
    description: SHORT_DESCRIPTION,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    },
    author: publisher
  };
};

export const getTechArticleJsonLd = ({
  title,
  description,
  path
}: {
  title: string;
  description?: string;
  path: string;
}): JsonLd => {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    url: getCanonicalUrl(path),
    mainEntityOfPage: getCanonicalUrl(path),
    author: publisher,
    publisher
  };
};

export const getFaqPageJsonLd = (
  items: Array<{ question: string; answer: string }>
): JsonLd => {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  };
};

// Kept in step with content/docs/faq.mdx by hand.
export const faqJsonLdItems = [
  {
    question: 'What is Tsamara, in plain words?',
    answer:
      'A prototype that represents a sukuk series as a token with a $10 unit on Solana. Approved investors can subscribe with stablecoins, transfer units to each other and receive distributions, and the rules about who may hold units are enforced by programs onchain.'
  },
  {
    question: 'Can I invest real money?',
    answer:
      'No. It runs on devnet with a mock series and test dollars that have no value. Nothing here is an offer of securities.'
  },
  {
    question: 'Is it certified by a sharia board?',
    answer:
      'No. It is designed with sharia principles in mind and has not been reviewed or certified by any sharia board.'
  },
  {
    question: 'Is it audited?',
    answer: 'No.'
  }
];
