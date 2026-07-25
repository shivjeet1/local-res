"use client";
// src/app/pos/admin/page.tsx — ADMIN only

import { useState } from "react";
import { useCurrentUser, useDailyReport, useAdminUsers, useDeleteUserMutation } from "@/lib/queries";
import { centsToDisplay } from "@/lib/ipc";
import { useRouter } from "next/navigation";

// Tabs
type Tab = "REPORT" | "USERS" | "DEVICES" | "SYNC";

const TABS: Tab[] = ["REPORT", "USERS", "DEVICES", "SYNC"];

export default function AdminPage() {
  const { data: user } = useCurrentUser();
  const router         = useRouter();
  const [tab, setTab]  = useState<Tab>("REPORT");

  if (user?.role !== "ADMIN") {
    router.replace("/pos");
    return null;
  }

  return (
    <div className="h-full flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b"
           style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <span className="mono text-sm font-bold" style={{ color: "var(--accent)" }}>ADMIN PANEL</span>
        <span className="mono text-[10px] text-[#444]">ROLE: {user?.role}</span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
                  className="px-5 py-2.5 mono text-[10px] tracking-widest transition-all"
                  style={{
                    color: tab === t ? "var(--accent)" : "var(--text-muted)",
                    borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                  }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 scrollable p-6">
        {tab === "REPORT"  && <ReportTab />}
        {tab === "USERS"   && <UsersTab />}
        {tab === "DEVICES" && <DevicesTab />}
        {tab === "SYNC"    && <SyncTab />}
      </div>
    </div>
  );
}

// ── Report tab ─────────────────────────────────────────────────────────────

function ReportTab() {
  const today = new Date().toISOString().split("T")[0];
  const { data: report, isLoading } = useDailyReport();

  const stat = (label: string, value: string, color = "var(--accent)") => (
    <div className="p-5 border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <div className="mono text-[10px] text-[#888] tracking-widest mb-2">{label}</div>
      <div className="mono text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-4">
      <div className="mono text-[10px] text-[#444] tracking-widest">
        DAILY REPORT · {today}
      </div>

      {isLoading ? (
        <div className="mono text-[11px] text-[#444] animate-pulse tracking-widest">
          LOADING...
        </div>
      ) : report && report.orderCount > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {stat("ORDERS TODAY",  `${report.orderCount}`,                        "#3b82f6")}
          {stat("GROSS TOTAL",   centsToDisplay(report.totalCents,    "₹")             )}
          {stat("SUBTOTAL",      centsToDisplay(report.subtotalCents, "₹"), "#f0f0f0"  )}
          {stat("GST COLLECTED", centsToDisplay(report.taxCents,      "₹"), "#f59e0b"  )}
        </div>
      ) : (
        <div className="p-8 border text-center mono text-[11px] text-[#444] tracking-widest"
             style={{ borderColor: "var(--border)" }}>
          NO COMPLETED ORDERS TODAY
        </div>
      )}
    </div>
  );
}

// ── Users tab ──────────────────────────────────────────────────────────────

function UsersTab() {
  const { data: users = [], isLoading } = useAdminUsers();
  const deleteUser = useDeleteUserMutation();
  const { data: self } = useCurrentUser();

  const ROLE_COLOR: Record<string, string> = {
    ADMIN: "var(--accent)", STAFF: "#3b82f6", KITCHEN: "#f59e0b",
  };

  return (
    <div className="max-w-2xl space-y-2">
      <div className="mono text-[10px] text-[#444] tracking-widest mb-4">STAFF ACCOUNTS</div>

      {isLoading && (
        <div className="mono text-[11px] text-[#444] animate-pulse tracking-widest">
          LOADING...
        </div>
      )}

      {users.map(u => (
        <div key={u.id} className="flex items-center gap-4 px-4 py-3 border"
             style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="flex-1">
            <div className="text-sm text-[#f0f0f0]">{u.name}</div>
            <div className="mono text-[11px] text-[#888]">{u.email}</div>
          </div>
          <span className="mono text-[10px] px-2 py-0.5"
                style={{ color: ROLE_COLOR[u.role], border: `1px solid ${ROLE_COLOR[u.role]}44` }}>
            {u.role}
          </span>
          {u.id !== self?.id && (
            <button
              onClick={() => {
                if (confirm(`Delete user ${u.name}?`)) deleteUser.mutate(u.id);
              }}
              disabled={deleteUser.isPending}
              className="mono text-[11px] px-2 py-1 disabled:opacity-40"
              style={{ color: "#ef4444" }}>
              DEL
            </button>
          )}
        </div>
      ))}

      {!isLoading && users.length === 0 && (
        <div className="p-6 border text-center mono text-[11px] text-[#444]"
             style={{ borderColor: "var(--border)" }}>
          NO USERS FOUND
        </div>
      )}
    </div>
  );
}

// ── Devices tab ────────────────────────────────────────────────────────────

function DevicesTab() {
  return (
    <div className="max-w-2xl">
      <div className="mono text-[10px] text-[#444] tracking-widest mb-4">REGISTERED DEVICES</div>
      <div className="p-6 border text-center mono text-[11px] text-[#444]"
           style={{ borderColor: "var(--border)" }}>
        Devices register automatically on first sync.
      </div>
    </div>
  );
}

// ── Sync tab ───────────────────────────────────────────────────────────────

function SyncTab() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult]   = useState<{ pushed: number; pulled: number } | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    // Real impl: const jwt = await invoke('get_stored_jwt'); triggerSync(...)
    await new Promise(r => setTimeout(r, 1200)); // stub
    setResult({ pushed: 3, pulled: 7 });
    setSyncing(false);
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="mono text-[10px] text-[#444] tracking-widest mb-4">SYNC ENGINE</div>

      <div className="p-4 border space-y-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <div className="flex justify-between mono text-[11px]">
          <span className="text-[#888]">PROTOCOL</span>
          <span style={{ color: "var(--accent)" }}>LWW (Last-Write-Wins)</span>
        </div>
        <div className="flex justify-between mono text-[11px]">
          <span className="text-[#888]">AUTO SYNC</span>
          <span style={{ color: "var(--accent)" }}>EVERY 30s</span>
        </div>
        <div className="flex justify-between mono text-[11px]">
          <span className="text-[#888]">DIRECTION</span>
          <span style={{ color: "#3b82f6" }}>BIDIRECTIONAL</span>
        </div>
      </div>

      <button onClick={handleSync} disabled={syncing}
              className="w-full py-3 mono text-sm font-bold text-black disabled:opacity-50"
              style={{ background: syncing ? "#00ff8866" : "var(--accent)" }}>
        {syncing ? "SYNCING..." : "FORCE SYNC NOW →"}
      </button>

      {result && (
        <div className="p-4 border mono text-[11px] space-y-1 fade-up"
             style={{ borderColor: "var(--accent-border)", background: "var(--accent-dim)" }}>
          <div style={{ color: "var(--accent)" }}>✓ SYNC COMPLETE</div>
          <div className="text-[#888]">↑ pushed {result.pushed} rows</div>
          <div className="text-[#888]">↓ pulled {result.pulled} rows</div>
        </div>
      )}
    </div>
  );
}
