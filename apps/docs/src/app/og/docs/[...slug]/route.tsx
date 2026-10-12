import { notFound } from 'next/navigation';
import { ImageResponse } from 'takumi-js/response';

import { DocsOgImage } from '@/components/og-image';
import { getPageImageUrl, source } from '@/lib/source';

export const revalidate = false;

const INTER_CDN = 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5.2.5';

const loadInter = async (weight: 400 | 500) => {
  const response = await fetch(`${INTER_CDN}/latin-${weight}-normal.ttf`);

  if (!response.ok) {
    throw new Error(`Failed to load Inter ${weight}: ${response.status}`);
  }

  return response.arrayBuffer();
};

export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) => {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));

  if (!page) notFound();

  const [regular, medium] = await Promise.all([loadInter(400), loadInter(500)]);

  return new ImageResponse(
    <DocsOgImage title={page.data.title} description={page.data.description} />,
    {
      width: 1200,
      height: 630,
      format: 'webp',
      fonts: [
        {
          name: 'Inter',
          data: regular,
          weight: 400,
          style: 'normal'
        },
        {
          name: 'Inter',
          data: medium,
          weight: 500,
          style: 'normal'
        }
      ]
    }
  );
};

export const generateStaticParams = () => {
  return source.getPages().map((page) => ({
    slug: getPageImageUrl(page).segments
  }));
};
