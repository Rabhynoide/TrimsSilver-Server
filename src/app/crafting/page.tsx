import { getAccess } from "@/lib/access";
import RestrictedAccess from "../RestrictedAccess";
import CraftingApp from "./CraftingApp";

export default async function CraftingPage() {
  const { session, access } = await getAccess();
  if (!access.hasFullAccess) {
    return <RestrictedAccess signedIn={access.signedIn} discordName={session?.user?.name} />;
  }

  return <CraftingApp isSignedIn={true} />;
}
