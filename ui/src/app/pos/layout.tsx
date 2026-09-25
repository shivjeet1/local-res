"use client";
// src/app/pos/layout.tsx

import { useCurrentUser, useLogoutMutation } from "@/lib/queries";
import { usePosStore } from "@/lib/store";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

  // Sync user into store on mount and guard routes
  useEffect(() => {
    if (user) {
      setUser(user);
      setRestaurant(user.restaurantId);
      
      // Route guards
      if (user.role === "KITCHEN" && pathname !== "/pos/kitchen") {
        router.replace("/pos/kitchen");
      } else if (user.role === "STAFF" && pathname.startsWith("/pos/admin")) {
        router.replace("/pos");
      }
    }
  }, [user, setUser, setRestaurant, pathname, router]);

  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }, []);

  if (isLoading) return (
    <div className="h-dvh flex flex-col items-center justify-center bg-background gap-4">
      <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      <span className="font-mono text-muted text-xs tracking-widest font-bold">
        LOADING...
      </span>
    </div>
  );

  if (!user) return null;

  const isAdmin = user.role === "ADMIN";
  const isStaff = user.role === "STAFF";
  const isKitchen = user.role === "KITCHEN";

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

  // Navigation Items per Role
  let navItems: { href: string; label: string; short: string; exact?: boolean }[] = [];
  if (isAdmin) {
    navItems = [
      { href: "/pos/admin", label: "Dashboard", short: "DASH", exact: true },
      { href: "/pos", label: "Orders", short: "POS", exact: true },
      { href: "/pos/menu", label: "Menu", short: "MENU" },
      { href: "/pos/admin/users", label: "Users", short: "USR" },
      // The prompt asks for Reports, Settings, but those routes might not exist yet. We'll map them to admin root for now.
    ];
  } else if (isStaff) {
    navItems = [
      { href: "/pos", label: "Orders & New", short: "POS", exact: true },
      { href: "/pos/menu", label: "Menu", short: "MENU" },
      // "Customers" route doesn't exist, we skip for now to not break the app.
    ];
  }

  // Kitchen Display is full-screen, no global nav
  if (isKitchen) {
    return (
      <div className="h-dvh flex bg-background overflow-hidden text-foreground selection:bg-accent/30">
        <div className="flex-1 min-w-0 overflow-hidden relative">
           {/* Add a floating logout/theme toggle for Kitchen */}
           <div className="absolute top-3 right-4 z-50 flex items-center gap-2">
             <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center bg-surface-1 rounded-full shadow-md text-muted hover:text-foreground">
               {theme === 'dark' ? '☼' : '☾'}
             </button>
             <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center bg-surface-1 rounded-full shadow-md text-red-500 hover:bg-red-500/10">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             </button>
           </div>
           {children}
        </div>
      </div>
    );
  }

  // Admin Sidebar vs Staff Top Nav
  const navLayoutClasses = isAdmin
    ? "md:static md:w-[88px] md:h-full md:flex-col md:items-center md:py-8 md:gap-4 md:border-r md:border-t-0 w-full h-16 flex-row items-center justify-around border-t fixed bottom-0 left-0" // Sidebar on desktop, bottom bar on mobile
    : "w-full h-16 flex-row items-center px-6 border-b fixed top-0 left-0 gap-4"; // Top nav for staff

  const contentPadding = isAdmin
    ? "pb-16 md:pb-0" // Space for bottom bar on mobile
    : "pt-16"; // Space for top nav

  return (
    <div className={`h-dvh flex ${isAdmin ? 'flex-row' : 'flex-col'} bg-background overflow-hidden text-foreground selection:bg-accent/30`}>

      <nav className={`flex bg-surface-1 border-border z-50 flex-shrink-0 shadow-sm ${navLayoutClasses}`}>
        {/* Logo */}
        <div className={`flex items-center justify-center bg-accent text-background rounded-xl shadow-lg shadow-accent/20 ${isAdmin ? 'hidden md:flex w-12 h-12 mb-6' : 'w-10 h-10 mr-4'}`}>
          <span className="font-mono text-[12px] font-bold leading-none tracking-tight">POS</span>
        </div>

        {/* Nav items */}
        {navItems.map(item => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={item.label}
              className={`flex items-center justify-center transition-all flex-shrink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface-1 ${
                isAdmin ? 'w-14 h-12 md:w-12 md:h-12' : 'px-4 h-10'
              } ${
                active 
                  ? "bg-accent text-background shadow-md shadow-accent/20" 
                  : "bg-transparent text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <span className="font-mono text-[10px] md:text-[10px] font-bold tracking-widest leading-none">
                {isAdmin ? item.short : item.label.toUpperCase()}
              </span>
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title="Toggle Theme"
          className={`flex items-center justify-center text-muted transition-colors flex-shrink-0 rounded-xl hover:bg-surface-2 hover:text-foreground focus:outline-none ${isAdmin ? 'w-12 h-12' : 'w-10 h-10'}`}
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>

        {/* Role badge (Hidden on Mobile for Admin, shown next to logout for Staff) */}
        {isAdmin ? (
          <div
            className="hidden md:block font-mono text-[9px] text-muted tracking-widest md:mb-4 uppercase font-bold"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {user.role}
          </div>
        ) : (
          <div className="hidden sm:block font-mono text-[10px] text-muted tracking-widest uppercase font-bold px-4">
            {user.role}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Logout"
          className={`flex items-center justify-center text-muted transition-colors flex-shrink-0 rounded-xl hover:bg-red-500/10 hover:text-red-500 focus:outline-none ${isAdmin ? 'w-12 h-12' : 'w-10 h-10'}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </nav>

      {/* ── Main area ────────────────────────────────── */}
      <div className={`flex-1 min-w-0 overflow-hidden w-full ${contentPadding}`}>
        {children}
      </div>
    </div>
  );
}
