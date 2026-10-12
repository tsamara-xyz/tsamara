import type { MetadataRoute } from 'next';

import { statSync } from 'node:fs';

import { siteUrl } from '@/lib/site';
import { source } from '@/lib/source';

const getFileLastModified = (absolutePath: string) => {
  try {
    return statSync(absolutePath).mtime;
  } catch {
    return undefined;
  }
};

const sitemap = (): MetadataRoute.Sitemap => {
  const pages = source.getPages().map((page) => {
    const isIntro = page.slugs.join('/') === 'introduction';
    const isQuickStart = page.slugs.join('/') === 'quick-start';

    return {
      url: `${siteUrl}${page.url}`,
      lastModified: getFileLastModified(page.absolutePath),
      changeFrequency: 'weekly' as const,
      priority: isIntro || isQuickStart ? 0.9 : 0.7
    };
  });

  return pages;
};

export default sitemap;
