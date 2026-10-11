import Link from "next/link";

export default function NotFound() {
  return (
    <p className="muted pad">
      Page not found. <Link href="/">Back to all series</Link>
    </p>
  );
}
