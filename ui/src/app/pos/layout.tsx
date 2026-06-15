"use client";
// src/app/pos/layout.tsx

import { useCurrentUser, useLogoutMutation } from "@/lib/queries";
import { usePosStore } from "@/lib/store";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

const NAV_ITEMS = [
  { href: "/pos",         label: "POS",     short: "POS"  },
  { href: "/pos/kitchen", label: "KITCHEN", short: "KDS"  },
  { href: "/pos/menu",    label: "MENU",    short: "MENU" },
  { href: "/pos/admin",   label: "ADMIN",   short: "ADM", adminOnly: true },
];

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useCurrentUser();
  const logout    = useLogoutMutation();
  const router    = useRouter();
  const pathname  = usePathname();
  const setUser   = usePosStore((s) => s.setUser);
  const setRestaurant = usePosStore((s) => s.setRestaurant);

  useEffect(() => {
    if (!isLoading && isError) router.replace("/");
  }, [isLoading, isError, router]);

  // Sync user into store on mount
  useEffect(() => {
    if (user) {
      setUser(user);
      setRestaurant(user.restaurantId);
    }
  }, [user, setUser, setRestaurant]);

  if (isLoading) return (
    <div className="h-dvh flex items-center justify-center bg-black">
      <span className="mono text-[#444] text-sm animate-pulse tracking-widest">
        LOADING...
      </span>
    </div>
  );

  if (!user) return null;

  const isAdmin = user.role === "ADMIN";

  async function handleLogout() {
    await logout.mutateAsync();
    router.replace("/");
  }

  return (
    <div className="h-dvh flex bg-black overflow-hidden">

      {/* ── Sidebar nav ─────────────────────────────── */}
      <nav
        className="w-14 flex flex-col items-center py-4 gap-1 border-r flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
      >
        {/* Logo */}
        <div
          className="w-9 h-9 flex items-center justify-center mb-4 flex-shrink-0"
          style={{ border: "1px solid var(--accent)", color: "var(--accent)" }}
        >
          <span className="mono text-[9px] font-bold leading-none">POS</span>
        </div>

        {/* Nav items */}
        {NAV_ITEMS.filter(n => !n.adminOnly || isAdmin).map(item => {
          const active = pathname === item.href ||
            (item.href !== "/pos" && pathname.startsWith(item.href));
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={item.label}
              className="w-10 h-10 flex items-center justify-center transition-all flex-shrink-0"
              style={{
                color:       active ? "var(--accent)"        : "var(--text-muted)",
                background:  active ? "var(--accent-dim)"    : "transparent",
                border:      active ? "1px solid var(--accent-border)" : "1px solid transparent",
              }}
            >
              <span className="mono text-[9px] font-bold tracking-wide leading-none">
                {item.short}
              </span>
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Role badge — rotated */}
        <div
          className="mono text-[8px] text-[#333] tracking-widest mb-3"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {user.role}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Logout"
          className="w-10 h-10 flex items-center justify-center mono text-[9px]
                     font-bold tracking-wide transition-colors flex-shrink-0"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ef4444"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}
        >
          OUT
        </button>
      </nav>

      {/* ── Main area ────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
