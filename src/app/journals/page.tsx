import { auth } from "@/auth";
import JournalsApp from "./JournalsApp";

export default async function JournalsPage() {
  const session = await auth();

  return <JournalsApp isSignedIn={!!session?.user} />;
}
