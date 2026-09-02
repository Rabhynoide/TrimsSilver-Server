import { getAccess } from "@/lib/access";
import RestrictedAccess from "../RestrictedAccess";
import FlipperApp from "./FlipperApp";

export default async function FlipperPage() {
  const { session, access } = await getAccess();
  if (!access.hasFullAccess) {
    return <RestrictedAccess signedIn={access.signedIn} discordName={session?.user?.name} />;
  }

  return <FlipperApp isSignedIn={true} />;
}
