"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/queries";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { data: user, isLoading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (user && !isLoading) {
      if (user.role === "ADMIN") router.push("/pos/admin");
      else if (user.role === "KITCHEN") router.push("/pos/kitchen");
      else router.push("/pos");
    }
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col font-sans selection:bg-accent/30 overflow-x-hidden">
      
      {/* Navbar */}
      <nav className="w-full flex items-center justify-between px-6 py-4 border-b border-border bg-surface-1/80 backdrop-blur-md fixed top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-accent text-background rounded-xl shadow-lg shadow-accent/20">
            <span className="font-mono text-sm font-bold tracking-tight">POS</span>
          </div>
          <span className="font-bold text-lg hidden sm:block tracking-tight">LocalRes</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="relative group font-mono text-sm font-bold px-6 py-2.5 rounded-xl bg-accent text-background overflow-hidden transition-all shadow-[0_0_15px_rgba(0,255,136,0.2)] hover:shadow-[0_0_25px_rgba(0,255,136,0.4)] hover:-translate-y-0.5 active:translate-y-0">
            <span className="relative z-10">SIGN IN</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
          </Link>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 pt-32 pb-24 flex flex-col gap-32">
        
        {/* Hero Section */}
        <section className="flex flex-col items-center text-center gap-6 fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-dim border border-accent-border text-accent font-mono text-xs font-bold mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            NOW WITH OFFLINE SUPPORT
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl leading-tight">
            The intelligent POS for <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">modern restaurants.</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted max-w-2xl mt-4 leading-relaxed">
            Streamline your orders, connect your kitchen, and manage your entire business — offline or online.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 w-full sm:w-auto">
            <Link href="/login" className="relative group w-full sm:w-auto px-8 py-4 rounded-2xl bg-accent text-background font-bold text-lg overflow-hidden transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)] hover:shadow-[0_0_35px_rgba(0,255,136,0.4)] hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2">
              <span className="relative z-10 text-black">Get Started</span>
              <svg className="w-5 h-5 relative z-10 text-black transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            </Link>
          </div>
        </section>

        {/* Role-Based Entry */}
        <section className="flex flex-col gap-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Built for your entire team</h2>
            <p className="text-muted">Dedicated interfaces optimized for every role.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-surface-1 border border-border flex flex-col items-center text-center hover:border-accent/50 transition-colors group">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Admin</h3>
              <p className="text-muted text-sm mb-6">Manage users, view sales analytics, and configure your restaurant.</p>
              <Link href="/login" className="mt-auto font-mono text-xs font-bold tracking-widest text-blue-500 hover:underline">ADMIN LOGIN →</Link>
            </div>
            <div className="p-8 rounded-3xl bg-surface-1 border border-border flex flex-col items-center text-center hover:border-accent/50 transition-colors group">
              <div className="w-16 h-16 rounded-2xl bg-accent-dim text-accent flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Staff / Cashier</h3>
              <p className="text-muted text-sm mb-6">Lightning-fast order entry, table management, and instant payments.</p>
              <Link href="/login" className="mt-auto font-mono text-xs font-bold tracking-widest text-accent hover:underline">STAFF LOGIN →</Link>
            </div>
            <div className="p-8 rounded-3xl bg-surface-1 border border-border flex flex-col items-center text-center hover:border-accent/50 transition-colors group">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Kitchen</h3>
              <p className="text-muted text-sm mb-6">Real-time Kanban displays with live timers to keep service flowing.</p>
              <Link href="/login" className="mt-auto font-mono text-xs font-bold tracking-widest text-amber-500 hover:underline">KITCHEN LOGIN →</Link>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="flex flex-col gap-10">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Everything you need to run your restaurant</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Order Management", desc: "Intuitive cart system with item modifications and seamless table mapping.", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
              { title: "Kitchen Display (KDS)", desc: "Replace paper tickets with a synchronized real-time Kanban board for the kitchen.", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
              { title: "GST Invoicing", desc: "One-tap GST calculation and toggle, fully compliant and ready for export.", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" },
              { title: "Sales Reports", desc: "Detailed analytics, daily summaries, and CSV exports to track your growth.", icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" },
              { title: "Multi-location", desc: "Built with multi-tenant scoping so you can manage multiple branches securely.", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
              { title: "Works Offline", desc: "Full PWA support with local-first sync. Never stop serving when the internet drops.", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-2xl bg-surface-2/50 border border-border flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center flex-shrink-0 text-muted">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.icon} /></svg>
                </div>
                <div>
                  <h4 className="font-bold mb-1">{feature.title}</h4>
                  <p className="text-sm text-muted leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border bg-surface-1 py-8 text-center text-sm text-muted font-mono">
        <p>© {new Date().getFullYear()} LocalRes POS. All rights reserved.</p>
      </footer>
    </div>
  );
}
