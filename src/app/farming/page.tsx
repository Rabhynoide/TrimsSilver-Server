import { auth } from "@/auth";
import FarmingApp from "./FarmingApp";

export default async function FarmingPage() {
  const session = await auth();

  return <FarmingApp isSignedIn={!!session?.user} />;
}
