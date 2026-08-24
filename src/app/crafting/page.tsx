import { auth } from "@/auth";
import CraftingApp from "./CraftingApp";

export default async function CraftingPage() {
  const session = await auth();

  return <CraftingApp isSignedIn={!!session?.user} />;
}
