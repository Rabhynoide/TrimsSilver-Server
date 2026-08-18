import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";

export default async function Header() {
  const session = await auth();

  return (
    <header className="border-b border-navy-700 bg-navy-850">
      <div className="flex items-center justify-between gap-4 px-8 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-wide text-gold-400">
            TrimsSilver
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/market-prices" className="text-navy-200 hover:text-gold-400">
              Market Prices
            </Link>
          </nav>
        </div>

        {session?.user ? (
          <div className="flex items-center gap-3">
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="h-7 w-7 rounded-full" />
            )}
            <span className="hidden text-sm text-navy-200 sm:inline">{session.user.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="rounded border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:bg-navy-700"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("discord");
            }}
          >
            <button
              type="submit"
              className="rounded bg-[#5865F2] px-3 py-1.5 text-sm text-white hover:bg-[#4752C4]"
            >
              Se connecter avec Discord
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
