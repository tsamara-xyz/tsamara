'use client';

import type { ComponentProps } from 'react';

import Link from 'fumadocs-core/link';

import { LogoGithubIcon } from '@/components/icons';
import { GITHUB_URL } from '@/lib/brand';
import { iconButtonClass } from '@/lib/styles';

export { GITHUB_URL };

export const GitHubIconLink = ({
  className,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'>) => {
  return (
    <Link
      href={GITHUB_URL}
      external
      aria-label="GitHub"
      className={iconButtonClass(className)}
      {...props}
    >
      <LogoGithubIcon size={16} className="size-4" />
    </Link>
  );
};
