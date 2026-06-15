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
      await login.mutateAsync({ email, password });
      router.push("/pos");
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    }
  }

  return (
    <div className="h-dvh w-full flex items-center justify-center bg-black relative overflow-hidden">

      {/* Grid background */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(#00ff88 1px, transparent 1px), linear-gradient(90deg, #00ff88 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Corner brackets */}
      <span className="absolute top-6 left-6 mono text-[10px] text-[#444]">POS//TERMINAL</span>
      <span className="absolute top-6 right-6 mono text-[10px] text-[#444]">v1.0.0</span>
      <span className="absolute bottom-6 left-6 mono text-[10px] text-[#444]">OFFLINE-FIRST</span>

      {/* Card */}
      <div className="relative w-full max-w-sm fade-up">
        {/* Top accent bar */}
        <div className="h-[2px] bg-[#00ff88] mb-0" />

        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
          className="p-8">

          {/* Header */}
          <div className="mb-8">
            <div className="mono text-[10px] text-[#444] mb-2 tracking-widest">AUTHENTICATE</div>
            <h1 className="text-2xl font-semibold text-[#f0f0f0] tracking-tight">
              Staff Login
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="mono text-[10px] text-[#888] tracking-widest block mb-2">
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full bg-black border text-[#f0f0f0] mono text-sm px-3 py-2.5
                           outline-none transition-colors"
                style={{
                  borderColor: "var(--border-bright)",
                  caretColor: "var(--accent)",
                }}
                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                onBlur={e => e.target.style.borderColor = "var(--border-bright)"}
                placeholder="staff@restaurant.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mono text-[10px] text-[#888] tracking-widest block mb-2">
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-black border text-[#f0f0f0] mono text-sm px-3 py-2.5
                           outline-none transition-colors"
                style={{
                  borderColor: "var(--border-bright)",
                  caretColor: "var(--accent)",
                }}
                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                onBlur={e => e.target.style.borderColor = "var(--border-bright)"}
                placeholder="••••••••"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mono text-[11px] text-[#ef4444] py-2 px-3"
                   style={{ background: "#ef444411", border: "1px solid #ef444433" }}>
                ✗ {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={login.isPending}
              className="w-full py-2.5 font-semibold text-black transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: login.isPending ? "#00ff8866" : "var(--accent)" }}
            >
              {login.isPending ? "AUTHENTICATING..." : "LOGIN →"}
            </button>
          </form>
        </div>

        {/* Bottom dim border */}
        <div className="h-[1px]" style={{ background: "var(--border)" }} />
      </div>
    </div>
  );
}
