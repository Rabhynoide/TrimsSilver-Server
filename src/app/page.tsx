import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold text-navy-100">TrimsSilver</h1>
      <p className="max-w-md text-navy-300">
        Backend indépendant pour le client de bureau TrimsSilver et ses données de marché Albion Online.
      </p>
      <Link
        href="/market-prices"
        className="rounded bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:bg-gold-400"
      >
        Ouvrir les prix du marché →
      </Link>
    </main>
  );
}
