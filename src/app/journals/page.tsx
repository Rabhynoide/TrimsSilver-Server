import { getAccess } from "@/lib/access";
import RestrictedAccess from "../RestrictedAccess";
import JournalsApp from "./JournalsApp";

export default async function JournalsPage() {
  const { session, access } = await getAccess();
  if (!access.hasFullAccess) {
    return <RestrictedAccess signedIn={access.signedIn} discordName={session?.user?.name} />;
  }

  return <JournalsApp isSignedIn={true} />;
}
