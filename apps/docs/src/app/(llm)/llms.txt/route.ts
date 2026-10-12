import { getCanonicalUrl, siteUrl } from '@/lib/site';
import { source } from '@/lib/source';

export const revalidate = false;

export const GET = () => {
  const docsLinks = source
    .getPages()
    .map((page) => {
      const markdown = `${getCanonicalUrl(page.url)}.md`;
      const description = page.data.description?.trim();
      const note = description ? `: ${description}` : '';

      return `- [${page.data.title}](${markdown})${note}`;
    })
    .join('\n');

  const body = [
    '# Tsamara',
    '',
    '> Sovereign sukuk in $10 units on Solana, with every transfer rule enforced onchain. An unlicensed devnet prototype with a mock series; the docs say what is proven and what is not.',
    '',
    'Links point at Markdown (`.md`). Drop the suffix for HTML.',
    '',
    '## Docs',
    '',
    docsLinks,
    '',
    '## Optional',
    '',
    `- [Full documentation](${siteUrl}/llms-full.txt): All pages in one Markdown file`,
    `- [MCP server](${siteUrl}/api/mcp): list_pages, search_docs, get_page`,
    `- [GitHub](https://github.com/tsamara-xyz/tsamara): Source, tests and the compliance mapping`,
    ''
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8'
    }
  });
};
