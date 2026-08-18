import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { mintApiToken } from "@/lib/api-auth";

// Restricted to loopback addresses: this page hands a fresh bearer token to whatever
// redirect_uri it's given, so an open redirect here would let a malicious link steal a
// signed-in user's credential. Only the desktop client's local HttpListener qualifies.
function parseLoopbackRedirect(raw: string | undefined): URL | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const isLoopbackHost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  return url.protocol === "http:" && isLoopbackHost ? url : null;
}

export default async function CliAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_uri?: string }>;
}) {
  const { redirect_uri: redirectUriParam } = await searchParams;
  const redirectUri = parseLoopbackRedirect(redirectUriParam);

  if (!redirectUri) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Lien invalide</h1>
        <p className="max-w-md text-navy-400">
          Ce lien doit provenir du client TrimsSilver et pointer vers une adresse locale
          (localhost).
        </p>
      </main>
    );
  }

  const session = await auth();

  // signIn() mutates cookies, which Next.js only allows inside a Server Action or Route
  // Handler — not during a plain page render — so sign-in has to be one click away here,
  // same as the home page's own "Se connecter avec Discord" button.
  async function signInAndReturn() {
    "use server";
    await signIn("discord", {
      redirectTo: `/cli-auth?redirect_uri=${encodeURIComponent(redirectUriParam!)}`,
    });
  }

  if (!session?.user?.id) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <h1 className="text-xl font-semibold">Connecter le client TrimsSilver</h1>
        <p className="max-w-md text-navy-400">
          Connecte-toi avec Discord pour autoriser l&apos;application de bureau.
        </p>
        <form action={signInAndReturn}>
          <button
            type="submit"
            className="rounded bg-[#5865F2] px-4 py-2 text-white hover:bg-[#4752C4]"
          >
            Se connecter avec Discord
          </button>
        </form>
      </main>
    );
  }

  // A server action (not the GET render above) is what actually mints a token, so
  // link previews/prefetches/reloads of this page never mint tokens as a side effect.
  async function connect() {
    "use server";
    const activeSession = await auth();
    const validatedRedirect = parseLoopbackRedirect(redirectUriParam);
    if (!activeSession?.user?.id || !validatedRedirect) {
      redirect("/cli-auth");
    }

    const { token } = await mintApiToken(activeSession.user.id, "TrimsSilver desktop client");
    validatedRedirect.searchParams.set("token", token);
    redirect(validatedRedirect.toString());
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-xl font-semibold">Connecter le client TrimsSilver</h1>
      <p className="max-w-md text-navy-400">
        Autoriser l&apos;application de bureau à se connecter avec le compte{" "}
        <strong>{session.user.name}</strong> ?
      </p>
      <form action={connect}>
        <button
          type="submit"
          className="rounded bg-[#5865F2] px-4 py-2 text-white hover:bg-[#4752C4]"
        >
          Autoriser
        </button>
      </form>
    </main>
  );
}
