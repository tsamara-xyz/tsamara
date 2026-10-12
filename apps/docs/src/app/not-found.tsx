import Link from 'next/link';

export const metadata = {
  title: 'Page not found'
};

const NotFound = () => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">404</h1>
      <p className="text-lg text-muted">This page could not be found.</p>
      <Link
        className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
        href="/docs/introduction"
      >
        Go to the docs
      </Link>
    </div>
  );
};

export default NotFound;
