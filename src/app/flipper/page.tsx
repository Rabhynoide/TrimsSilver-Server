import { auth } from "@/auth";
import FlipperApp from "./FlipperApp";

export default async function FlipperPage() {
  const session = await auth();

  return <FlipperApp isSignedIn={!!session?.user} />;
}
