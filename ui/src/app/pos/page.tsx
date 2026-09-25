"use client";
// src/app/pos/page.tsx — 3-panel POS: Orders | Menu | Cart

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  useOpenOrders, useMenu, useTables, useCreateOrderMutation,
  useAddItemMutation, useRemoveItemMutation,
  useUpdateStatusMutation, useVoidOrderMutation, useToggleGstMutation,
  useOrderReadyNotification,
} from "@/lib/queries";
import { usePosStore } from "@/lib/store";
import { centsToDisplay, type Order, type OrderStatus, type Product } from "@/lib/ipc";
import OrderStatusBadge from "@/components/OrderStatusBadge";

// ── Left: Open orders panel ───────────────────────────────────────────────────

function OrdersPanel({
  activeId, onSelect, tableMap,
}: { activeId: string | null; onSelect: (id: string) => void; tableMap: Map<string, string> }) {
  const { data: orders = [], isLoading } = useOpenOrders();
  const createOrder = useCreateOrderMutation();
  const user = usePosStore((s) => s.user);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");

  const canCreate = user?.role !== "KITCHEN";

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filter !== "ALL" && o.status !== filter) return false;
      if (search) {
        const orderNum = o.id.slice(-6).toUpperCase();
        const tableLabel = o.tableId ? tableMap.get(o.tableId)?.toUpperCase() ?? "" : "";
        const s = search.toUpperCase();
        if (!orderNum.includes(s) && !tableLabel.includes(s)) return false;
      }
      return true;
    });
  }, [orders, filter, search, tableMap]);

  return (
    <div className={`w-full md:w-80 flex-col border-r border-border bg-surface-1 flex-shrink-0 md:flex z-10 ${activeId ? "hidden" : "flex"}`}>
      <div className="flex flex-col border-b border-border shadow-sm p-4 gap-3 bg-surface-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted tracking-widest font-semibold">ORDERS</span>
          {canCreate && (
            <button
              onClick={() => createOrder.mutateAsync({}).then(o => onSelect(o.id))}
              disabled={createOrder.isPending}
              className="font-mono text-[10px] font-bold px-3 py-1.5 rounded-md transition-all disabled:opacity-40 text-accent border border-accent-border hover:bg-accent-dim focus:ring-2 focus:ring-accent focus:outline-none"
              aria-label="Create new order">
              + NEW
            </button>
          )}
        </div>
        
        {/* Search & Filter */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search order # or table..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as OrderStatus | "ALL")}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent font-mono"
            aria-label="Filter orders by status"
          >
            <option value="ALL">ALL STATUSES</option>
            <option value="OPEN">NEW (OPEN)</option>
            <option value="SENT_TO_KITCHEN">PREPARING</option>
            <option value="READY">READY</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollable">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse flex flex-col gap-3 p-4 border border-border rounded-xl bg-surface-2/50">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-surface-3 rounded w-1/3"></div>
                  <div className="h-5 bg-surface-3 rounded w-1/4"></div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="h-3 bg-surface-3 rounded w-1/4"></div>
                  <div className="h-4 bg-surface-3 rounded w-1/5"></div>
                </div>
              </div>
            ))}
          </div>
        )}
        {filteredOrders.map((order: Order) => {
          const isOld = (Date.now() - new Date(order.createdAt).getTime()) > 15 * 60 * 1000;
          const isActive = activeId === order.id;
          
          let borderClass = isActive ? "border-l-accent" : "border-l-transparent";
          if (isOld && (order.status === "OPEN" || order.status === "SENT_TO_KITCHEN")) {
            borderClass = isActive ? "border-l-red-500 bg-red-500/5" : "border-l-red-400 bg-red-500/5 hover:bg-surface-2";
          } else if (!isActive) {
            borderClass += " hover:bg-surface-2";
          } else {
            borderClass += " bg-accent-dim";
          }

          return (
            <button key={order.id} onClick={() => onSelect(order.id)}
              className={`w-full text-left px-4 py-4 border-b border-border transition-colors focus:outline-none focus:bg-surface-2 border-l-4 ${borderClass}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-mono text-[11px] font-semibold ${isOld && order.status !== 'COMPLETED' ? 'text-red-500' : 'text-foreground'}`}>
                  #{order.id.slice(-6).toUpperCase()}
                  {order.tableId && tableMap.get(order.tableId) && (
                    <span className="ml-2 text-accent">
                      · {tableMap.get(order.tableId)}
                    </span>
                  )}
                </span>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted flex items-center gap-2">
                  <span>{order.items.filter((i: any) => !i.deletedAt).length} item(s)</span>
                  {isOld && (order.status === "OPEN" || order.status === "SENT_TO_KITCHEN") && (
                    <span className="font-mono text-[9px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded animate-pulse">
                      &gt;15m
                    </span>
                  )}
                </span>
                <span className="font-mono text-[12px] font-bold text-accent">
                  {centsToDisplay(order.totalCents)}
                </span>
              </div>
            </button>
          );
        })}
        {!isLoading && filteredOrders.length === 0 && (
          <div className="p-8 flex flex-col items-center justify-center text-center opacity-60">
            <svg className="w-12 h-12 text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="font-mono text-[11px] text-muted tracking-widest">NO ORDERS FOUND</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Middle: Menu grid ─────────────────────────────────────────────────────────

function MenuPanel({ onClearActiveId, onAddItem, activeOrderId, setShowCartOnMobile }: { onClearActiveId?: () => void; onAddItem: (p: Product) => void; activeOrderId: string | null; setShowCartOnMobile?: (v: boolean) => void }) {
  const { data: menu, isLoading } = useMenu();
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
    <div className={`flex-1 flex flex-col min-w-0 bg-background ${!activeOrderId ? 'hidden md:flex' : 'flex'}`}>
      {/* Mobile back button */}
      <div className="md:hidden flex border-b border-border px-4 py-3 bg-surface-2">
        <button onClick={() => onClearActiveId?.()} className="font-mono text-[11px] font-bold text-accent tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          BACK TO ORDERS
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex border-b border-border overflow-x-auto scrollable flex-shrink-0 bg-surface-1 shadow-sm relative z-0">
        {categories.map(cat => {
          const active = cat.id === displayCat;
          return (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)}
              className={`px-6 py-4 font-mono text-[11px] font-bold tracking-widest whitespace-nowrap transition-all focus:outline-none ${
                active ? "text-accent border-b-2 border-b-accent bg-accent-dim" : "text-muted border-b-2 border-b-transparent hover:text-foreground hover:bg-surface-2"
              }`}>
              {cat.name.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Mobile cart FAB */}
      {activeOrderId && setShowCartOnMobile && (
        <button
          onClick={() => setShowCartOnMobile(true)}
          className="md:hidden absolute bottom-6 right-6 z-30 px-6 py-3 rounded-full shadow-2xl font-mono text-[11px] font-bold tracking-widest transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 bg-accent text-background">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          VIEW CART
        </button>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto scrollable p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
        {isLoading && Array.from({length: 8}).map((_, i) => (
          <div key={i} className="animate-pulse p-4 rounded-xl bg-surface-2 border border-border h-32 flex flex-col justify-between">
            <div className="h-4 bg-surface-3 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-5 bg-surface-3 rounded w-1/3"></div>
              <div className="h-3 bg-surface-3 rounded w-1/4"></div>
            </div>
          </div>
        ))}
        {!isLoading && filtered.map((product, i) => (
          <button key={product.id}
            onClick={() => canAdd && activeOrderId && onAddItem(product)}
            disabled={!canAdd || !activeOrderId}
            className="text-left p-4 rounded-xl transition-all flex flex-col justify-between h-full group focus:outline-none focus:ring-2 focus:ring-accent"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              opacity: (!canAdd || !activeOrderId) ? 0.5 : 1,
              cursor: (!canAdd || !activeOrderId) ? "not-allowed" : "pointer",
              animation: `fade-up 0.3s ease-out ${i * 0.03}s both`
            }}
            onMouseEnter={e => {
              if (canAdd && activeOrderId) {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)";
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
            }}
          >
            <div className="text-[13px] font-semibold text-foreground mb-3 leading-snug line-clamp-3">
              {product.name}
            </div>
            <div>
              <div className="font-mono text-[13px] font-bold text-accent">
                {centsToDisplay(product.priceCents)}
              </div>
              {product.taxRatePct > 0 && (
                <div className="font-mono text-[9px] text-muted mt-1 font-medium">
                  +{product.taxRatePct}% GST
                </div>
              )}
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center opacity-60">
            <svg className="w-12 h-12 text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="font-mono text-[11px] text-muted tracking-widest">NO ITEMS IN CATEGORY</span>
          </div>
        )}
      </div>

      {/* Warning bar */}
      {canAdd && !activeOrderId && (
        <div className="px-6 py-3 font-mono text-[10px] font-bold tracking-widest border-t border-amber-500/30 bg-amber-500/10 text-amber-600 flex-shrink-0 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          SELECT OR CREATE AN ORDER TO ADD ITEMS
        </div>
      )}
    </div>
  );
}

// ── Right: Cart / active order ────────────────────────────────────────────────

function CartPanel({
 orderId, productMap, tableMap, showCartOnMobile, setShowCartOnMobile,
}: { orderId: string; productMap: Map<string, Product>; tableMap: Map<string, string>; showCartOnMobile?: boolean; setShowCartOnMobile?: (v: boolean) => void }) {
  const { data: orders = [] } = useOpenOrders();
  const order = orders.find(o => o.id === orderId);

  const removeItem   = useRemoveItemMutation();
  const updateStatus = useUpdateStatusMutation();
  const voidOrder    = useVoidOrderMutation();
  const toggleGst    = useToggleGstMutation();
  const user         = usePosStore((s) => s.user);

  if (!order) return (
    <div className="w-full md:w-96 flex items-center justify-center md:border-l border-border bg-surface-1 flex-shrink-0 absolute md:relative inset-0 md:inset-auto z-40">
      <span className="font-mono text-[11px] text-muted tracking-widest">ORDER NOT FOUND</span>
    </div>
  );

  const activeItems = order.items.filter((i: any) => !i.deletedAt);
  const canModify   = order.status === "OPEN" && user?.role !== "KITCHEN";
  const canVoid     = ["OPEN","SENT_TO_KITCHEN"].includes(order.status) && user?.role === "ADMIN";
  const canDeliver  = order.status === "READY" && user?.role !== "KITCHEN";
  const canPay      = order.status === "DELIVERED" && user?.role !== "KITCHEN";
  const tableLabel  = order.tableId ? tableMap.get(order.tableId) : null;

  return (
    <div className={`w-full md:w-96 flex flex-col md:border-l border-border flex-shrink-0 absolute md:relative inset-0 md:inset-auto z-40 bg-surface-1 md:bg-surface-1 shadow-2xl md:shadow-none transition-transform transform duration-300 ease-out ${showCartOnMobile ? "translate-x-0" : "translate-x-full md:translate-x-0"}`}>

      {/* Header */}
      {setShowCartOnMobile && (
        <button onClick={() => setShowCartOnMobile(false)} className="md:hidden p-4 border-b border-border font-mono text-[11px] font-bold text-accent tracking-widest bg-surface-2 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          BACK TO MENU
        </button>
      )}
      
      <div className="px-6 py-5 border-b border-border flex-shrink-0 bg-surface-1">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[11px] font-bold text-muted tracking-widest flex items-center">
            ORDER #{order.id.slice(-6).toUpperCase()}
            {tableLabel && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-accent-dim text-accent text-[9px] border border-accent-border">TBL {tableLabel}</span>
            )}
          </span>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="font-mono text-[11px] text-muted font-medium">
          {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          <span className="mx-2 opacity-50">|</span>
          {activeItems.length} item{activeItems.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto scrollable bg-background/50">
        <div className="flex flex-col">
          {activeItems.map((item: any, i: number) => {
            const product = productMap.get(item.productId);
            return (
              <div key={item.id}
                   className="flex items-center gap-3 px-6 py-4 border-b border-border/50 group bg-surface-1 hover:bg-surface-2 transition-colors fade-up"
                   style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground truncate mb-1">
                    {product?.name ?? item.productId.slice(-8)}
                  </div>
                  <div className="font-mono text-[11px] text-muted font-medium">
                    {item.quantity} × {centsToDisplay(item.unitPriceCents)}
                  </div>
                </div>
                <div className="font-mono text-[13px] font-bold text-foreground flex-shrink-0">
                  {centsToDisplay(item.unitPriceCents * item.quantity)}
                </div>
                {canModify && (
                  <button
                    onClick={() => removeItem.mutate({ orderId: order.id, itemId: item.id })}
                    disabled={removeItem.isPending}
                    className="opacity-0 group-hover:opacity-100 font-mono text-[14px] transition-opacity w-8 h-8 flex items-center justify-center flex-shrink-0 text-red-500 hover:bg-red-500/10 rounded-full focus:opacity-100 focus:outline-none"
                    aria-label="Remove item">
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {activeItems.length === 0 && (
          <div className="p-10 flex flex-col items-center justify-center opacity-60">
            <svg className="w-10 h-10 text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="font-mono text-[11px] text-muted tracking-widest">EMPTY CART</span>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="px-6 py-4 border-t border-border flex-shrink-0 bg-surface-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
        <div className="space-y-3 mb-4">
          <div className="flex justify-between font-mono text-[12px] text-muted font-medium">
            <span>SUBTOTAL</span><span>{centsToDisplay(order.subtotalCents)}</span>
          </div>
          <div className="flex justify-between items-center font-mono text-[12px] text-muted font-medium">
            <div className="flex items-center gap-3">
              <span className={order.applyGst !== false ? "text-foreground font-bold" : ""}>GST (TAX)</span>
              <button
                role="switch"
                aria-checked={order.applyGst !== false}
                disabled={!canModify || toggleGst.isPending}
                onClick={() => {
                  const currentlyApplied = order.applyGst !== false;
                  if (currentlyApplied && order.taxCents > 0) {
                    if (!confirm("Are you sure you want to remove GST from this order?")) return;
                  }
                  toggleGst.mutate({ orderId: order.id, applyGst: !currentlyApplied });
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface-1 ${order.applyGst !== false ? 'bg-accent' : 'bg-surface-3'} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-background transition-transform ${order.applyGst !== false ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
            <span className={order.applyGst !== false ? "text-foreground" : "line-through opacity-50"}>
              {centsToDisplay(order.taxCents)}
            </span>
          </div>
        </div>
        <div className="flex justify-between items-end pt-3 border-t border-border">
          <span className="font-mono text-[11px] font-bold text-muted tracking-widest">TOTAL</span>
          <span className="font-mono text-[20px] font-bold text-accent leading-none">{centsToDisplay(order.totalCents)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pb-6 pt-2 space-y-3 flex-shrink-0 bg-surface-1">
        {order.status === "OPEN" && canModify && (
          <button
            onClick={() => updateStatus.mutate({ orderId: order.id, status: "SENT_TO_KITCHEN" })}
            disabled={activeItems.length === 0 || updateStatus.isPending}
            className="w-full py-4 rounded-xl font-bold font-mono text-[12px] tracking-wide text-background bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90 hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98] focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background flex items-center justify-center gap-2">
            SEND TO KITCHEN
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        )}
        {order.status === "SENT_TO_KITCHEN" && (
          <div className="w-full py-3 rounded-xl font-mono text-[11px] font-bold text-center tracking-widest bg-amber-500/10 border border-amber-500/30 text-amber-600 flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            WAITING FOR KITCHEN
          </div>
        )}
        {order.status === "READY" && (
          <div className="w-full py-3 rounded-xl font-mono text-[11px] font-bold text-center tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 animate-pulse flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            READY FOR PICKUP
          </div>
        )}
        {canDeliver && (
          <button
            onClick={() => updateStatus.mutate({ orderId: order.id, status: "DELIVERED" })}
            disabled={updateStatus.isPending}
            className="w-full py-4 rounded-xl font-bold font-mono text-[12px] tracking-wide text-white bg-purple-600 transition-all hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-background flex items-center justify-center gap-2">
            MARK DELIVERED
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        )}
        {canPay && (
          <button
            onClick={() => updateStatus.mutate({ orderId: order.id, status: "COMPLETED" })}
            disabled={updateStatus.isPending}
            className="w-full py-4 rounded-xl font-bold font-mono text-[12px] tracking-wide text-background bg-accent transition-all hover:opacity-90 hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98] focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            MARK PAID
          </button>
        )}
        {canVoid && (
          <button
            onClick={() => {
              if (confirm(`Void order #${order.id.slice(-6).toUpperCase()}?`))
                voidOrder.mutate(order.id);
            }}
            className="w-full py-2.5 rounded-lg font-mono text-[10px] font-bold tracking-widest text-red-500 border border-red-500/20 hover:bg-red-500/10 transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none mt-4">
            VOID ORDER
          </button>
        )}
      </div>
    </div>
  );
}

// ── Toast notification ────────────────────────────────────────────────────────

function playReadyChime() {
  try {
    const ctx  = new AudioContext();
    const play = (freq: number, startAt: number, duration: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type      = "sine";
      osc.frequency.setValueAtTime(freq, startAt);
      gain.gain.setValueAtTime(0.4, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
      osc.start(startAt);
      osc.stop(startAt + duration);
    };
    const t = ctx.currentTime;
    play(660, t,        0.18);
    play(880, t + 0.20, 0.25);
    setTimeout(() => ctx.close(), 600);
  } catch {
    // AudioContext not available (SSR / blocked by policy) — silently skip
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PosPage() {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [showCartOnMobile, setShowCartOnMobile] = useState(false);
  const [toast, setToast]                 = useState<string | null>(null);
  const toastTimer                        = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addItem = useAddItemMutation();
  const { data: menu }   = useMenu();
  const { data: tables } = useTables();

  const productMap = new Map<string, Product>(
    (menu?.products ?? []).map(p => [p.id, p])
  );
  const tableMap = new Map<string, string>(
    (tables ?? []).map(t => [t.id, t.label])
  );

  const handleOrderReady = useCallback(() => {
    playReadyChime();
    setToast("🍽 An order is ready for pickup!");
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  useOrderReadyNotification(handleOrderReady);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function handleAddItem(product: Product) {
    if (!activeOrderId) return;
    addItem.mutate({ orderId: activeOrderId, productId: product.id, quantity: 1 });
  }

  return (
    <div className="h-full flex overflow-hidden relative bg-background text-foreground">

      {/* Toast notification */}
      {toast && (
        <div
          onClick={() => setToast(null)}
          className="absolute top-6 left-1/2 z-50 cursor-pointer slide-in font-mono text-[11px] font-bold tracking-widest px-6 py-4 rounded-full transition-all flex items-center gap-3 shadow-2xl"
          style={{
            transform:  "translateX(-50%)",
            background: "rgba(16, 185, 129, 0.15)",
            border:     "1px solid rgba(16, 185, 129, 0.4)",
            color:      "#10b981",
            backdropFilter: "blur(8px)",
          }}>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          {toast}
        </div>
      )}

      <OrdersPanel activeId={activeOrderId} onSelect={setActiveOrderId} tableMap={tableMap} />
      <MenuPanel onClearActiveId={() => setActiveOrderId(null)} onAddItem={handleAddItem} activeOrderId={activeOrderId} setShowCartOnMobile={setShowCartOnMobile} />
      {activeOrderId
        ? <CartPanel orderId={activeOrderId} productMap={productMap} tableMap={tableMap} showCartOnMobile={showCartOnMobile} setShowCartOnMobile={setShowCartOnMobile} />
        : (
          <div className="hidden md:flex w-96 items-center justify-center border-l border-border bg-surface-1 flex-shrink-0">
            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div className="font-mono text-[11px] font-bold text-muted tracking-widest mb-1">NO ORDER SELECTED</div>
              <div className="font-mono text-[10px] text-muted opacity-60 tracking-wider">Select or create an order</div>
            </div>
          </div>
        )
      }
    </div>
  );
}
