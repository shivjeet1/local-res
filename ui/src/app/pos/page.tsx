"use client";
// src/app/pos/page.tsx — 3-panel POS: Orders | Menu | Cart

import { useState } from "react";
import {
  useOpenOrders, useMenu, useCreateOrderMutation,
  useAddItemMutation, useRemoveItemMutation,
  useUpdateStatusMutation, useVoidOrderMutation,
} from "@/lib/queries";
import { usePosStore } from "@/lib/store";
import { centsToDisplay, type Order, type OrderItem, type OrderStatus, type Product } from "@/lib/ipc";

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<OrderStatus, string> = {
  OPEN:            "#3b82f6",
  SENT_TO_KITCHEN: "#f59e0b",
  READY:           "#00ff88",
  COMPLETED:       "#444444",
  VOIDED:          "#ef4444",
};

function StatusChip({ status }: { status: OrderStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span className="mono text-[9px] px-1.5 py-0.5 tracking-widest leading-none"
          style={{ color: c, border: `1px solid ${c}44`, background: `${c}11` }}>
      {status.replace("_", " ")}
    </span>
  );
}

// ── Left: Open orders panel ───────────────────────────────────────────────────

function OrdersPanel({
  activeId, onSelect,
}: { activeId: string | null; onSelect: (id: string) => void }) {
  const { data: orders = [], isLoading } = useOpenOrders();
  const createOrder = useCreateOrderMutation();
  const user = usePosStore((s) => s.user);

  const canCreate = user?.role !== "KITCHEN";

  return (
    <div className="w-64 flex flex-col border-r flex-shrink-0"
         style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>

      <div className="flex items-center justify-between px-3 py-3 border-b"
           style={{ borderColor: "var(--border)" }}>
        <span className="mono text-[10px] text-[#888] tracking-widest">OPEN ORDERS</span>
        {canCreate && (
          <button
            onClick={() => createOrder.mutateAsync({}).then(o => onSelect(o.id))}
            disabled={createOrder.isPending}
            className="mono text-[10px] px-2 py-1 transition-all disabled:opacity-40"
            style={{ color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
            + NEW
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {isLoading && (
          <div className="p-4 mono text-[11px] text-[#444] animate-pulse tracking-widest">
            LOADING...
          </div>
        )}
        {orders.map(order => (
          <button key={order.id} onClick={() => onSelect(order.id)}
            className="w-full text-left px-3 py-3 border-b transition-all"
            style={{
              borderColor: "var(--border)",
              background:   activeId === order.id ? "var(--accent-dim)" : "transparent",
              borderLeft:   activeId === order.id
                ? "2px solid var(--accent)" : "2px solid transparent",
            }}>
            <div className="flex items-center justify-between mb-1">
              <span className="mono text-[10px] text-[#888]">
                #{order.id.slice(-6).toUpperCase()}
              </span>
              <StatusChip status={order.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#888]">
                {order.items.filter(i => !i.deletedAt).length} item(s)
              </span>
              <span className="mono text-[11px]" style={{ color: "var(--accent)" }}>
                {centsToDisplay(order.totalCents)}
              </span>
            </div>
          </button>
        ))}
        {!isLoading && orders.length === 0 && (
          <div className="p-6 text-center mono text-[11px] text-[#333] tracking-widest">
            NO OPEN ORDERS
          </div>
        )}
      </div>
    </div>
  );
}

// ── Middle: Menu grid ─────────────────────────────────────────────────────────

function MenuPanel({
  onAddItem, activeOrderId,
}: { onAddItem: (p: Product) => void; activeOrderId: string | null }) {
  const { data: menu } = useMenu();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const user = usePosStore((s) => s.user);

  const canAdd = user?.role !== "KITCHEN";
  const categories = menu?.categories ?? [];
  const products   = menu?.products   ?? [];
  const displayCat = activeCat ?? categories[0]?.id ?? null;
  const filtered   = products.filter(p =>
    p.isAvailable && !p.deletedAt && (displayCat ? p.categoryId === displayCat : true)
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Category tabs */}
      <div className="flex border-b overflow-x-auto flex-shrink-0"
           style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        {categories.map(cat => {
          const active = cat.id === displayCat;
          return (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)}
              className="px-4 py-3 mono text-[10px] tracking-widest whitespace-nowrap transition-all"
              style={{
                color:        active ? "var(--accent)"  : "var(--text-muted)",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                background:   active ? "var(--accent-dim)" : "transparent",
              }}>
              {cat.name.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2 content-start"
           style={{ scrollbarWidth: "thin" }}>
        {filtered.map(product => (
          <button key={product.id}
            onClick={() => canAdd && activeOrderId && onAddItem(product)}
            disabled={!canAdd || !activeOrderId}
            className="text-left p-3 transition-all"
            style={{
              background: "var(--surface-2)",
              border:     "1px solid var(--border)",
              opacity:    (!canAdd || !activeOrderId) ? 0.45 : 1,
              cursor:     (!canAdd || !activeOrderId) ? "not-allowed" : "pointer",
            }}
            onMouseEnter={e => {
              if (canAdd && activeOrderId)
                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-border)";
            }}
            onMouseLeave={e =>
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"
            }
          >
            <div className="text-xs font-medium text-[#f0f0f0] mb-2 leading-tight line-clamp-2">
              {product.name}
            </div>
            <div className="mono text-xs" style={{ color: "var(--accent)" }}>
              {centsToDisplay(product.priceCents)}
            </div>
            {product.taxRatePct > 0 && (
              <div className="mono text-[9px] text-[#444] mt-0.5">
                +{product.taxRatePct}% GST
              </div>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 py-12 text-center mono text-[11px] text-[#444]">
            NO ITEMS IN CATEGORY
          </div>
        )}
      </div>

      {/* Warning bar */}
      {canAdd && !activeOrderId && (
        <div className="px-4 py-2 mono text-[10px] tracking-widest border-t flex-shrink-0"
             style={{ borderColor: "var(--border)", background: "#f59e0b11", color: "#f59e0b" }}>
          ⚠ SELECT OR CREATE AN ORDER TO ADD ITEMS
        </div>
      )}
    </div>
  );
}

// ── Right: Cart / active order ────────────────────────────────────────────────

function CartPanel({
  orderId, productMap,
}: { orderId: string; productMap: Map<string, Product> }) {
  const { data: orders = [] } = useOpenOrders();
  const order = orders.find(o => o.id === orderId);

  const removeItem   = useRemoveItemMutation();
  const updateStatus = useUpdateStatusMutation();
  const voidOrder    = useVoidOrderMutation();
  const user         = usePosStore((s) => s.user);

  if (!order) return (
    <div className="w-80 flex items-center justify-center border-l flex-shrink-0"
         style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
      <span className="mono text-[11px] text-[#444]">ORDER NOT FOUND</span>
    </div>
  );

  const activeItems = order.items.filter(i => !i.deletedAt);
  const canModify   = order.status === "OPEN" && user?.role !== "KITCHEN";
  const canVoid     = ["OPEN","SENT_TO_KITCHEN"].includes(order.status) && user?.role === "ADMIN";
  const canComplete = order.status === "READY" && user?.role !== "KITCHEN";

  return (
    <div className="w-80 flex flex-col border-l flex-shrink-0"
         style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>

      {/* Header */}
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-1">
          <span className="mono text-[10px] text-[#888] tracking-widest">
            ORDER #{order.id.slice(-6).toUpperCase()}
          </span>
          <StatusChip status={order.status} />
        </div>
        <div className="mono text-[10px] text-[#444]">
          {new Date(order.createdAt).toLocaleTimeString("en-IN",
            { hour: "2-digit", minute: "2-digit" })}
          {" · "}{activeItems.length} item{activeItems.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {activeItems.map(item => {
          const product = productMap.get(item.productId);
          return (
            <div key={item.id}
                 className="flex items-center gap-2 px-4 py-2.5 border-b group"
                 style={{ borderColor: "var(--border)" }}>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#f0f0f0] truncate">
                  {product?.name ?? item.productId.slice(-8)}
                </div>
                <div className="mono text-[10px] text-[#888]">
                  ×{item.quantity} · {centsToDisplay(item.unitPriceCents)}
                </div>
              </div>
              <div className="mono text-xs flex-shrink-0" style={{ color: "var(--accent)" }}>
                {centsToDisplay(item.unitPriceCents * item.quantity)}
              </div>
              {canModify && (
                <button
                  onClick={() => removeItem.mutate({ orderId: order.id, itemId: item.id })}
                  disabled={removeItem.isPending}
                  className="opacity-0 group-hover:opacity-100 mono text-[11px]
                             transition-opacity w-5 h-5 flex items-center justify-center
                             flex-shrink-0"
                  style={{ color: "#ef4444" }}>
                  ✕
                </button>
              )}
            </div>
          );
        })}
        {activeItems.length === 0 && (
          <div className="p-6 text-center mono text-[11px] text-[#444]">
            EMPTY ORDER
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="px-4 py-3 border-t space-y-1 flex-shrink-0"
           style={{ borderColor: "var(--border)" }}>
        <div className="flex justify-between mono text-[11px] text-[#888]">
          <span>SUBTOTAL</span><span>{centsToDisplay(order.subtotalCents)}</span>
        </div>
        <div className="flex justify-between mono text-[11px] text-[#888]">
          <span>GST</span><span>{centsToDisplay(order.taxCents)}</span>
        </div>
        <div className="flex justify-between mono text-sm font-bold pt-1 border-t"
             style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
          <span>TOTAL</span><span>{centsToDisplay(order.totalCents)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 space-y-2 flex-shrink-0">
        {order.status === "OPEN" && canModify && (
          <button
            onClick={() => updateStatus.mutate({ orderId: order.id, status: "SENT_TO_KITCHEN" })}
            disabled={activeItems.length === 0 || updateStatus.isPending}
            className="w-full py-2.5 font-semibold text-black mono text-sm
                       disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ background: "var(--accent)" }}>
            SEND TO KITCHEN →
          </button>
        )}
        {order.status === "SENT_TO_KITCHEN" && (
          <div className="w-full py-2 mono text-[11px] text-center tracking-widest"
               style={{ color: "#f59e0b", border: "1px solid #f59e0b33" }}>
            ⏳ WAITING FOR KITCHEN
          </div>
        )}
        {order.status === "READY" && canComplete && (
          <button
            onClick={() => updateStatus.mutate({ orderId: order.id, status: "COMPLETED" })}
            disabled={updateStatus.isPending}
            className="w-full py-2.5 font-semibold text-black mono text-sm"
            style={{ background: "var(--accent)" }}>
            MARK PAID ✓
          </button>
        )}
        {canVoid && (
          <button
            onClick={() => {
              if (confirm(`Void order #${order.id.slice(-6).toUpperCase()}?`))
                voidOrder.mutate(order.id);
            }}
            className="w-full py-2 mono text-[11px] transition-colors"
            style={{ color: "#ef4444", border: "1px solid #ef444433" }}>
            VOID ORDER
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PosPage() {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const addItem = useAddItemMutation();
  const { data: menu } = useMenu();

  // Build product lookup map for cart item name resolution
  const productMap = new Map<string, Product>(
    (menu?.products ?? []).map(p => [p.id, p])
  );

  function handleAddItem(product: Product) {
    if (!activeOrderId) return;
    addItem.mutate({ orderId: activeOrderId, productId: product.id, quantity: 1 });
  }

  return (
    <div className="h-full flex overflow-hidden">
      <OrdersPanel activeId={activeOrderId} onSelect={setActiveOrderId} />
      <MenuPanel   onAddItem={handleAddItem} activeOrderId={activeOrderId} />
      {activeOrderId
        ? <CartPanel orderId={activeOrderId} productMap={productMap} />
        : (
          <div className="w-80 flex items-center justify-center border-l flex-shrink-0"
               style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
            <div className="text-center space-y-2">
              <div className="mono text-[10px] text-[#333] tracking-widest">NO ORDER SELECTED</div>
              <div className="mono text-[11px] text-[#222]">← select or create</div>
            </div>
          </div>
        )
      }
    </div>
  );
}
