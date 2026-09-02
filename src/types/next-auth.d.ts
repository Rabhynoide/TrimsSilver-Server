import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
      hasFullAccess: boolean;
    } & DefaultSession["user"];
  }
}

// next-auth's own `User`/`AdapterUser` are type-only re-exports of
// @auth/core's (`export type { User } from "@auth/core/types"` — see
// next-auth/index.d.ts), so augmenting "next-auth" itself wouldn't merge
// into them; this is the module TypeScript actually needs augmented for
// `user.isAdmin`/`user.hasFullAccess` to type-check in src/auth.ts's
// session() callback and signIn event (AdapterUser extends this User).
declare module "@auth/core/types" {
  interface User {
    isAdmin: boolean;
    hasFullAccess: boolean;
  }
}
