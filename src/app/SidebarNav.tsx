"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function MarketIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function FarmingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-9" />
      <path d="M12 13c0-4-3-6-7-6 0 4 3 6 7 6z" />
      <path d="M12 13c0-5 3-8 8-8 0 5-3 8-8 8z" />
    </svg>
  );
}

function CraftingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
    </svg>
  );
}

function CraftFinderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 7v5" />
      <path d="M12 12L6.5 17" />
      <path d="M12 12L17.5 17" />
    </svg>
  );
}

function FlipperIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function JournalsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto shrink-0 opacity-70">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z" />
    </svg>
  );
}

type NavItem = { href: string; label: string; icon: ReactNode; restricted?: boolean };

// "restricted: true" means this route needs User.hasFullAccess — see
// src/lib/access.ts and every gated page.tsx's own RestrictedAccess
// fallback. Kept in sync by hand with that set of pages (small, stable
// list) rather than derived, same as NAV_ITEMS always was.
const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: <HomeIcon /> },
  { href: "/market-prices", label: "Prix du marché", icon: <MarketIcon /> },
  { href: "/farming", label: "Agriculture et élevage", icon: <FarmingIcon />, restricted: true },
  { href: "/crafting", label: "Calculateur d'artisanat", icon: <CraftingIcon />, restricted: true },
  { href: "/craft-finder", label: "Quoi fabriquer", icon: <CraftFinderIcon />, restricted: true },
  { href: "/journals", label: "Calculateur de registres", icon: <JournalsIcon />, restricted: true },
  { href: "/flipper", label: "Flipper", icon: <FlipperIcon />, restricted: true },
];

export default function SidebarNav({ hasFullAccess, isAdmin }: { hasFullAccess: boolean; isAdmin: boolean }) {
  const pathname = usePathname();

  const items: NavItem[] = isAdmin
    ? [...NAV_ITEMS, { href: "/admin/users", label: "Administration", icon: <AdminIcon /> }]
    : NAV_ITEMS;

  return (
    <aside className="w-56 shrink-0 border-r border-navy-700 bg-navy-850 p-3">
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const locked = item.restricted && !hasFullAccess;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={locked ? "Accès restreint — demandez à l'administrateur" : undefined}
              className={`flex items-center gap-3 rounded px-3 py-2 text-sm ${
                active
                  ? "bg-navy-700 font-semibold text-gold-400"
                  : locked
                    ? "text-navy-500 hover:bg-navy-700 hover:text-navy-300"
                    : "text-navy-200 hover:bg-navy-700 hover:text-navy-100"
              }`}
            >
              {item.icon}
              {item.label}
              {locked && <LockIcon />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
