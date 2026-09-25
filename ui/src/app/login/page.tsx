"use client";
// src/app/page.tsx — Login screen

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLoginMutation } from "@/lib/queries";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const router   = useRouter();
  const login    = useLoginMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { user } = await login.mutateAsync({ email, password });
      if (user.role === "ADMIN") {
        router.push("/pos/admin");
      } else if (user.role === "KITCHEN") {
        router.push("/pos/kitchen");
      } else {
        router.push("/pos");
      }
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    }
  }

  return (
    <div className="h-dvh w-full flex items-center justify-center bg-background relative overflow-hidden">

      {/* Grid background with subtle pulse */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      
      {/* Background glowing orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Corner markers */}
      <div className="absolute top-8 left-8 flex items-center gap-3">
        <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
        <span className="mono text-[10px] text-muted tracking-widest font-bold">TERMINAL_SECURE</span>
      </div>
      <span className="absolute top-8 right-8 mono text-[10px] text-muted tracking-widest font-bold">SYS.v1.0</span>
      <span className="absolute bottom-8 left-8 mono text-[10px] text-muted tracking-widest font-bold">NODE_OFFLINE_READY</span>

      {/* Login Card */}
      <div className="relative w-full max-w-[400px] fade-up z-10 px-4">
        
        <div className="backdrop-blur-2xl bg-surface-1/60 border border-border/50 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden group">
          
          {/* Accent gradient hover effect across full UI element as requested */}
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          {/* Header */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 text-accent mb-6">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">
              Staff Portal
            </h1>
            <p className="mono text-[11px] text-muted tracking-widest uppercase">
              Authorized Personnel Only
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 relative">
            {/* Email */}
            <div className="space-y-2">
              <label className="mono text-[10px] text-muted tracking-widest font-bold ml-1">
                ACCESS ID (EMAIL)
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full bg-surface-2/80 border border-border text-foreground font-mono text-sm px-4 py-3.5
                           rounded-xl outline-none transition-all focus:border-accent focus:bg-surface-3 focus:shadow-[0_0_15px_rgba(0,255,136,0.1)] hover:border-border-bright"
                placeholder="staff@restaurant.com"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="mono text-[10px] text-muted tracking-widest font-bold ml-1">
                SECURITY KEY
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-surface-2/80 border border-border text-foreground font-mono text-sm px-4 py-3.5
                           rounded-xl outline-none transition-all focus:border-accent focus:bg-surface-3 focus:shadow-[0_0_15px_rgba(0,255,136,0.1)] hover:border-border-bright"
                placeholder="••••••••"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mono text-[11px] text-red-400 py-3 px-4 rounded-xl slide-in font-bold flex items-center gap-2"
                   style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={login.isPending}
              className="w-full mt-4 py-3.5 font-bold font-mono tracking-widest text-black transition-all rounded-xl relative overflow-hidden group
                         disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,255,136,0.2)] hover:shadow-[0_0_30px_rgba(0,255,136,0.4)] hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: login.isPending ? "var(--surface-3)" : "var(--accent)", color: login.isPending ? "var(--text-muted)" : "#000" }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {login.isPending ? "AUTHENTICATING..." : "INITIALIZE LOGIN"}
                {!login.isPending && <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
              </span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
