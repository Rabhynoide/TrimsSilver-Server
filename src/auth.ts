import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Comma-separated Discord account ids (the numeric snowflake — the same id
// on a user's own "Copy User ID" in Discord's developer mode, not their
// username) that get isAdmin+hasFullAccess auto-applied on every sign-in.
// This is how the very first admin gets bootstrapped with no admin UI or
// direct DB access needed: set it in Portainer's stack env var UI (same
// pattern as AUTH_SECRET etc., see PROJECT_STATUS.md), sign in once via
// Discord, done. Runs on every sign-in (not just account creation) so
// adding an id here later still promotes an already-existing account, and
// is additive-only — removing an id here does NOT revoke access, since env
// var edits shouldn't silently lock someone out; use /admin/users for that.
const ADMIN_DISCORD_IDS = new Set(
  (process.env.ADMIN_DISCORD_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [Discord],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.isAdmin = user.isAdmin;
      session.user.hasFullAccess = user.hasFullAccess;
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (account?.provider !== "discord" || !account.providerAccountId) return;
      if (!ADMIN_DISCORD_IDS.has(account.providerAccountId)) return;
      if (user.isAdmin && user.hasFullAccess) return;
      await prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: true, hasFullAccess: true },
      });
    },
  },
});
