import type { source } from '@/lib/source';

import { renderPlaceholder } from 'fumadocs-core/mdx-plugins/remark-llms.runtime';

import { getCanonicalUrl, siteUrl } from '@/lib/site';

export const collapseBlankLines = (text: string) => {
  return `${text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
};

const renderCallout = ({
  attributes,
  children
}: {
  attributes: Record<string, unknown>;
  children: string;
}) => {
  const type =
    typeof attributes.type === 'string' && attributes.type.length > 0
      ? attributes.type
      : 'info';
  const body = children.trim();

  if (!body) {
    return '';
  }

  return `> **${type}:** ${body}`;
};

const polishLLMMarkdown = (markdown: string) => {
  return markdown
    .replace(/^(#{1,6}\s.+?)\s*\[#[^\]]+\]\s*$/gm, '$1')
    .replace(/\]\((\/docs\/[^)#]+)(#[^)]*)?\)/g, (_match, path, hash = '') => {
      return `](${siteUrl}${path}${hash ?? ''})`;
    });
};

export const formatLLMMarkdown = async (markdown: string) => {
  const rendered = await renderPlaceholder(markdown, {
    Callout: renderCallout
  });

  return collapseBlankLines(polishLLMMarkdown(rendered));
};

export const getLLMText = async (page: (typeof source)['$inferPage']) => {
  const processed = await page.data.getText('processed');
  const body = await formatLLMMarkdown(processed);
  const description = page.data.description?.trim();
  const lead = description ? `${description}\n\n` : '';
  const url = getCanonicalUrl(page.url);

  return collapseBlankLines(`# ${page.data.title} (${url})\n\n${lead}${body}`);
};
