import { getAccess } from "@/lib/access";
import SidebarNav from "./SidebarNav";

// Server wrapper so the nav can know hasFullAccess/isAdmin (to lock
// restricted items and show the Admin link) without needing a client-side
// session hook — same "auth() in a server component, pass plain props down"
// pattern Header.tsx already uses.
export default async function Sidebar() {
  const { access } = await getAccess();
  return <SidebarNav hasFullAccess={access.hasFullAccess} isAdmin={access.isAdmin} />;
}
