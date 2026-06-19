"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useDevMockSync } from "@/lib/queries";

// Subscribes to cross-tab dev-mock changes (see ipc.ts) and invalidates
// open-orders/menu queries immediately. Must live inside QueryClientProvider
// since it needs useQueryClient(). No-op / inert when running under Tauri.
function DevMockSyncBridge({ children }: { children: ReactNode }) {
  useDevMockSync();
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry:                1,
            refetchOnWindowFocus: false,
            staleTime:            30_000,
          },
        },
      })
  );
  return (
    <QueryClientProvider client={qc}>
      <DevMockSyncBridge>{children}</DevMockSyncBridge>
    </QueryClientProvider>
  );
}
