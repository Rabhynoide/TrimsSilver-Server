import { auth } from "@/auth";
import CraftFinderApp from "./CraftFinderApp";

export default async function CraftFinderPage() {
  const session = await auth();

  return <CraftFinderApp isSignedIn={!!session?.user} />;
}
