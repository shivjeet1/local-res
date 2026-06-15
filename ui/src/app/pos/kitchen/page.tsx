"use client";
// src/app/pos/kitchen/page.tsx — Kitchen Display System

import { useOpenOrders, useUpdateStatusMutation, useMenu } from "@/lib/queries";
import { type Order, type OrderStatus } from "@/lib/ipc";

const COLUMNS: { status: OrderStatus; label: string; color: string }[] = [
  { status: "SENT_TO_KITCHEN", label: "INCOMING", color: "#f59e0b" },
  { status: "READY",           label: "READY",    color: "#00ff88" },
];

function elapsed(createdAt: number): string {
  const secs = Math.floor((Date.now() - createdAt) / 1000);
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h`;
}

function KitchenCard({
  order,
  productMap,
}: {
  order: Order;
  productMap: Map<string, string>;
}) {
  const updateStatus = useUpdateStatusMutation();
  const isIncoming   = order.status === "SENT_TO_KITCHEN";
  const color        = isIncoming ? "#f59e0b" : "#00ff88";
  const elapsedSecs  = Math.floor((Date.now() - order.createdAt) / 1000);
  const isUrgent     = isIncoming && elapsedSecs > 600;
  const activeItems  = order.items.filter(i => !i.deletedAt);

  return (
    <div className="p-4 transition-all"
         style={{
           background: "var(--surface-2)",
           border:     `1px solid ${isUrgent ? "#ef4444" : color}44`,
           borderLeft: `3px solid ${isUrgent ? "#ef4444" : color}`,
         }}>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="mono font-bold text-sm" style={{ color }}>
            #{order.id.slice(-6).toUpperCase()}
          </span>
          {order.tableId && (
            <span className="mono text-[9px] px-1.5 py-0.5 text-[#888]"
                  style={{ border: "1px solid var(--border)" }}>
              TBL
            </span>
          )}
        </div>
        <span className={`mono text-[11px] ${isUrgent ? "text-[#ef4444] animate-pulse" : "text-[#888]"}`}>
          {elapsed(order.createdAt)}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {activeItems.map(item => (
          <div key={item.id} className="flex items-start gap-3">
            <span className="mono text-sm font-bold w-6 text-right flex-shrink-0"
                  style={{ color }}>
              {item.quantity}×
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[#f0f0f0]">
                {productMap.get(item.productId) ?? item.productId.slice(-8)}
              </div>
              {item.notes && (
                <div className="mono text-[10px] mt-0.5" style={{ color: "#f59e0b" }}>
                  ⚠ {item.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="mono text-[10px] px-2 py-1.5 mb-3"
             style={{ background: "#f59e0b11", border: "1px solid #f59e0b33", color: "#f59e0b" }}>
          NOTE: {order.notes}
        </div>
      )}

      {isIncoming && (
        <button
          onClick={() => updateStatus.mutate({ orderId: order.id, status: "READY" })}
          disabled={updateStatus.isPending}
          className="w-full py-2 mono text-sm font-bold text-black
                     disabled:opacity-50 transition-opacity"
          style={{ background: "#00ff88" }}>
          MARK READY ✓
        </button>
      )}
    </div>
  );
}

export default function KitchenPage() {
  const { data: allOrders = [], isLoading, dataUpdatedAt } = useOpenOrders();
  const { data: menu } = useMenu();

  const productMap = new Map<string, string>(
    (menu?.products ?? []).map(p => [p.id, p.name])
  );

  return (
    <div className="h-full flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
           style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <span className="mono text-sm font-bold tracking-widest"
              style={{ color: "var(--accent)" }}>
          KITCHEN DISPLAY
        </span>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full animate-pulse inline-block"
                style={{ background: "var(--accent)" }} />
          <span className="mono text-[10px] text-[#444]">
            {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN") : "—"}
          </span>
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 flex overflow-hidden">
        {COLUMNS.map(col => {
          const orders = allOrders.filter(o => o.status === col.status);
          return (
            <div key={col.status} className="flex-1 flex flex-col border-r"
                 style={{ borderColor: "var(--border)" }}>

              <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0"
                   style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
                <span className="mono text-[10px] tracking-widest font-bold"
                      style={{ color: col.color }}>
                  {col.label}
                </span>
                <span className="mono text-xs px-2 py-0.5"
                      style={{
                        color:      col.color,
                        border:     `1px solid ${col.color}44`,
                        background: `${col.color}11`,
                      }}>
                  {orders.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3"
                   style={{ scrollbarWidth: "thin" }}>
                {isLoading && (
                  <div className="mono text-[11px] text-[#444] animate-pulse p-4 tracking-widest">
                    LOADING...
                  </div>
                )}
                {orders.map(o => (
                  <KitchenCard key={o.id} order={o} productMap={productMap} />
                ))}
                {!isLoading && orders.length === 0 && (
                  <div className="py-12 text-center mono text-[11px] text-[#333] tracking-widest">
                    CLEAR
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
