import { getAccess } from "@/lib/access";
import RestrictedAccess from "../RestrictedAccess";
import CraftFinderApp from "./CraftFinderApp";

export default async function CraftFinderPage() {
  const { session, access } = await getAccess();
  if (!access.hasFullAccess) {
    return <RestrictedAccess signedIn={access.signedIn} discordName={session?.user?.name} />;
  }

  return <CraftFinderApp isSignedIn={true} />;
}
