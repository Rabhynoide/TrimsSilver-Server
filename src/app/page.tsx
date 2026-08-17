import { auth, signIn, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">TrimsSilver</h1>

      {session?.user ? (
        <div className="flex flex-col items-center gap-4">
          {session.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              className="h-16 w-16 rounded-full"
            />
          )}
          <p>
            Connecté en tant que <strong>{session.user.name}</strong>
          </p>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button
              type="submit"
              className="rounded bg-neutral-800 px-4 py-2 text-white hover:bg-neutral-700"
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
            className="rounded bg-[#5865F2] px-4 py-2 text-white hover:bg-[#4752C4]"
          >
            Se connecter avec Discord
          </button>
        </form>
      )}
    </main>
  );
}
