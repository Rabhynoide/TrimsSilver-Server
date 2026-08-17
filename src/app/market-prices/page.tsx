import { auth } from "@/auth";
import MarketPricesApp from "./MarketPricesApp";

export default async function MarketPricesPage() {
  const session = await auth();

  return <MarketPricesApp isSignedIn={!!session?.user} />;
}
