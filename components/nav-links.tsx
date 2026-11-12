"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  /** "Masuk" is the only call to action in the guest nav. */
  prominent?: boolean;
}

const ITEM_BASE =
  "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50";
const ITEM_IDLE = "text-muted-foreground hover:bg-muted hover:text-foreground";
const ITEM_ACTIVE = "bg-secondary text-secondary-foreground";
const ITEM_PROMINENT =
  "bg-primary text-primary-foreground hover:bg-primary/90";

const GUEST_ITEMS: NavItem[] = [
  { href: "/", label: "Hari Ini" },
  { href: "/login", label: "Masuk", prominent: true },
];

const MEMBER_ITEMS: NavItem[] = [
  { href: "/", label: "Hari Ini" },
  { href: "/leaderboard", label: "Papan Peringkat" },
  { href: "/profil", label: "Profil" },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dasbor" },
  { href: "/admin/soal", label: "Soal" },
  { href: "/admin/koreksi", label: "Koreksi" },
  { href: "/admin/member", label: "Member" },
];

function isActive(pathname: string, href: string): boolean {
  // "/" and "/admin" are index routes and must match exactly, otherwise
  // "Dasbor" would light up on every /admin/* page as well.
  if (href === "/" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <ul className="flex items-center gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                ITEM_BASE,
                item.prominent && !active ? ITEM_PROMINENT : ITEM_IDLE,
                active && ITEM_ACTIVE,
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Navigasi utama, berbeda per peran (docs/UI_GUIDE.md + SPEC.md section 3).
 * Mobile: satu baris yang bisa digeser mendatar (tanpa hamburger), setiap
 * tautan minimal 44 px.
 */
export function NavLinks({ role }: { role: Role | null }) {
  const pathname = usePathname() ?? "/";
  const items = role ? MEMBER_ITEMS : GUEST_ITEMS;

  return (
    <nav aria-label="Navigasi utama" className="border-t border-border/70">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-1 overflow-x-auto px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <NavList items={items} pathname={pathname} />
        {role === "admin" ? (
          <>
            <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border" />
            <div role="group" aria-label="Menu admin">
              <NavList items={ADMIN_ITEMS} pathname={pathname} />
            </div>
          </>
        ) : null}
      </div>
    </nav>
  );
}
