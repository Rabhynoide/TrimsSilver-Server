import Link from "next/link";
import { signIn } from "@/auth";

// Rendered by every gated feature page instead of the real page when
// User.hasFullAccess is false — see src/lib/access.ts. Deliberately never
// renders the real feature component at all (not just hides a button) so an
// unapproved account can't see the page's data even briefly; the matching
// API routes are gated the same way server-side, so this isn't just a UI
// nicety either.
export default function RestrictedAccess({
  signedIn,
  discordName,
}: {
  signedIn: boolean;
  discordName?: string | null;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold text-navy-100">Accès restreint</h1>
      {signedIn ? (
        <>
          <p className="max-w-md text-sm text-navy-300">
            Cette page est réservée aux comptes approuvés par l&apos;administrateur du site.
            {discordName && (
              <>
                {" "}
                Votre compte Discord (<span className="font-medium text-navy-100">{discordName}</span>) n&apos;a
                pas encore été validé.
              </>
            )}
          </p>
          <p className="text-sm text-navy-400">
            Demandez à l&apos;administrateur de vous donner accès, puis revenez sur cette page.
          </p>
        </>
      ) : (
        <>
          <p className="max-w-md text-sm text-navy-300">
            Cette page est réservée aux comptes approuvés par l&apos;administrateur du site — connectez-vous avec
            Discord, puis demandez l&apos;accès.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("discord");
            }}
          >
            <button
              type="submit"
              className="rounded bg-[#5865F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4752C4]"
            >
              Se connecter avec Discord
            </button>
          </form>
        </>
      )}
      <Link href="/" className="text-sm text-navy-400 underline hover:text-navy-200">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
