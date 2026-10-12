import type { FC } from 'react';

import Image from 'next/image';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

// The same mark as the landing and the app.
const Logo: FC<LogoProps> = ({ width = 22, height = 22, className }) => {
  return (
    <Image
      src="/brand/mark.png"
      alt=""
      width={width}
      height={height}
      className={className}
      priority
    />
  );
};

export default Logo;
