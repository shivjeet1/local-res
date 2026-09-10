"use client";
// src/app/pos/layout.tsx

import { useCurrentUser, useLogoutMutation } from "@/lib/queries";
import { usePosStore } from "@/lib/store";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

  
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }, []);

  if (isLoading) return (
    <div className="h-dvh flex items-center justify-center bg-background">
      <span className="mono text-[#444] text-sm animate-pulse tracking-widest">
        LOADING...
      </span>
    </div>
  );

  if (!user) return null;

  const isAdmin = user.role === "ADMIN";


  

  const toggleTheme = () => {
    if (theme === 'dark') {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setTheme('light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setTheme('dark');
    }
  };

  async function handleLogout() {

    await logout.mutateAsync();
    router.replace("/");
  }

  return (
    <div className="h-dvh flex bg-background overflow-hidden">

      {/* ── Sidebar nav ─────────────────────────────── */}
      {/* ── Navigation (Sidebar on Desktop, Bottom Bar on Mobile) ─────────────────────────────── */}
      <nav
        className="
          flex bg-surface-1 border-border z-50 flex-shrink-0
          md:static md:w-[80px] md:h-full md:flex-col md:items-center md:py-6 md:gap-4 md:border-r md:border-t-0
          w-full h-14 flex-row items-center justify-around border-t fixed bottom-0 left-0
        "
        style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
      >
        {/* Logo (Hidden on Mobile) */}
        <div
          className="hidden md:flex w-9 h-9 items-center justify-center mb-4 flex-shrink-0"
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
              className="w-12 h-10 md:w-10 md:h-10 flex items-center justify-center transition-all flex-shrink-0"
              style={{
                color:       active ? "var(--accent)"        : "var(--text-muted)",
                background:  active ? "var(--accent-dim)"    : "transparent",
                border:      active ? "1px solid var(--accent-border)" : "1px solid transparent",
              }}
            >
              <span className="mono text-[10px] md:text-[9px] font-bold tracking-wide leading-none">
                {item.short}
              </span>
            </button>
          );
        })}

        <div className="hidden md:flex flex-1" />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title="Toggle Theme"
          className="w-10 h-10 flex items-center justify-center mono text-[14px] transition-colors flex-shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          {theme === 'dark' ? '☼' : '☾'}
        </button>

        {/* Role badge (Hidden on Mobile) */}
        <div
          className="hidden md:block mono text-[8px] text-muted tracking-widest md:mb-3"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: "var(--text-muted)" }}
        >
          {user.role}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Logout"
          className="w-10 h-10 flex items-center justify-center mono text-[10px] md:text-[9px]
                     font-bold tracking-wide transition-colors flex-shrink-0"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ef4444"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}
        >
          OUT
        </button>
      </nav>

      {/* ── Main area ────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden pb-14 md:pb-0">
        {children}
      </div>
    </div>
  );
}
