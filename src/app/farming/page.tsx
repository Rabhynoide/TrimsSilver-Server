import { getAccess } from "@/lib/access";
import RestrictedAccess from "../RestrictedAccess";
import FarmingApp from "./FarmingApp";

export default async function FarmingPage() {
  const { session, access } = await getAccess();
  if (!access.hasFullAccess) {
    return <RestrictedAccess signedIn={access.signedIn} discordName={session?.user?.name} />;
  }

  return <FarmingApp isSignedIn={true} />;
}
