import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link href="/accounts/" className="text-sm font-medium text-indigo-600 hover:underline">
        Back to accounts
      </Link>
    </div>
  );
}
