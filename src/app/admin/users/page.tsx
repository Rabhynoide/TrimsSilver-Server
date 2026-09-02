import { getAccess } from "@/lib/access";
import RestrictedAccess from "../../RestrictedAccess";
import AdminUsersApp from "./AdminUsersApp";

export default async function AdminUsersPage() {
  const { session, access } = await getAccess();
  if (!access.isAdmin) {
    return <RestrictedAccess signedIn={access.signedIn} discordName={session?.user?.name} />;
  }

  return <AdminUsersApp currentUserId={session!.user.id} />;
}
