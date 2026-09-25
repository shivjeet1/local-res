"use client";
import { useOpenOrders, useUpdateStatusMutation, useMenu, useTables } from "@/lib/queries";
import { type Order, type OrderStatus } from "@/lib/ipc";
import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const COLUMNS: { status: OrderStatus; label: string; textClass: string; bgClass: string; borderClass: string }[] = [
  { status: "OPEN",            label: "NEW",       textClass: "text-red-500",     bgClass: "bg-red-500",     borderClass: "border-red-500" },
  { status: "SENT_TO_KITCHEN", label: "PREPARING", textClass: "text-amber-500",   bgClass: "bg-amber-500",   borderClass: "border-amber-500" },
  { status: "READY",           label: "READY",     textClass: "text-emerald-500", bgClass: "bg-emerald-500", borderClass: "border-emerald-500" },
];

function elapsed(createdAt: number, now: number): string {
  const secs = Math.floor((now - createdAt) / 1000);
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h`;
}

function KitchenCard({
  order,
  productMap,
  tableMap,
  isOverlay = false,
}: {
  order: Order;
  productMap: Map<string, string>;
  tableMap: Map<string, string>;
  isOverlay?: boolean;
}) {
  const updateStatus = useUpdateStatusMutation();
  const [now, setNow] = useState(Date.now());

  // Live timer update
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedSecs  = Math.floor((now - order.createdAt) / 1000);
  const activeItems  = order.items.filter((i: any) => !i.deletedAt);
  const tableLabel   = order.tableId ? tableMap.get(order.tableId) : null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id, data: { status: order.status } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.3 : 1,
    zIndex: isOverlay ? 9999 : "auto",
    ...(isOverlay && {
      transform: `${CSS.Transform.toString(transform) || ""} rotate(2deg)`,
    })
  };

  // Color-code by age
  // white < 5 min, yellow 5–15 min, red > 15 min
  let ageBgClass = "bg-surface-2";
  let ageBorderClass = "border-border";
  let ageTextClass = "text-foreground";
  if (elapsedSecs >= 900) { // > 15 min
    ageBgClass = "bg-red-950/40";
    ageBorderClass = "border-red-500/50";
    ageTextClass = "text-red-400";
  } else if (elapsedSecs >= 300) { // 5-15 min
    ageBgClass = "bg-amber-950/30";
    ageBorderClass = "border-amber-500/40";
    ageTextClass = "text-amber-400";
  }

  // Next action logic
  let nextAction: { label: string; status: OrderStatus; bg: string } | null = null;
  if (order.status === "OPEN") {
    nextAction = { label: "START PREPARING", status: "SENT_TO_KITCHEN", bg: "bg-amber-600 hover:bg-amber-500" };
  } else if (order.status === "SENT_TO_KITCHEN") {
    nextAction = { label: "MARK READY", status: "READY", bg: "bg-emerald-600 hover:bg-emerald-500" };
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} 
         className={`p-6 rounded-2xl transition-all relative border-2 ${ageBorderClass} ${ageBgClass} ${
           isOverlay ? "shadow-2xl cursor-grabbing" : "shadow-md cursor-grab hover:shadow-lg"
         }`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className={`font-mono font-bold text-2xl ${ageTextClass}`}>
            #{order.id.slice(-6).toUpperCase()}
          </span>
          {order.tableId && (
            <span className="font-mono text-lg px-3 py-1 rounded text-foreground border border-border bg-surface-1">
              TBL {tableLabel ?? ""}
            </span>
          )}
        </div>
        <span className={`font-mono text-xl font-bold px-3 py-1.5 rounded ${elapsedSecs > 900 ? "text-red-500 bg-red-500/20 animate-pulse" : "text-muted bg-surface-3"}`}>
          {elapsed(order.createdAt, now)}
        </span>
      </div>

      <div className="space-y-4 mb-6 pointer-events-none">
        {activeItems.map((item: any) => (
          <div key={item.id} className="flex items-start gap-4">
            <span className={`font-mono text-xl font-black w-10 text-right flex-shrink-0 ${ageTextClass}`}>
              {item.quantity}×
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xl font-medium text-foreground leading-tight">
                {productMap.get(item.productId) ?? item.productId.slice(-8)}
              </div>
              {item.notes && (
                <div className="font-mono text-base mt-2 text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg inline-block border border-amber-500/20">
                  ⚠ {item.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="font-mono text-lg px-4 py-3 rounded-xl mb-6 pointer-events-none bg-amber-500/10 border border-amber-500/30 text-amber-500 font-medium">
          NOTE: {order.notes}
        </div>
      )}

      {nextAction && (
        <button
          onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ orderId: order.id, status: nextAction!.status }); }}
          disabled={updateStatus.isPending}
          onPointerDown={(e) => e.stopPropagation()}
          className={`w-full h-16 rounded-xl font-mono text-lg font-bold text-white disabled:opacity-50 transition-all active:scale-[0.98] z-10 relative flex items-center justify-center gap-3 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-surface-2 cursor-pointer ${nextAction.bg}`}>
          {nextAction.label}
        </button>
      )}
    </div>
  );
}

import { useDroppable } from "@dnd-kit/core";

function Column({ col, orders, productMap, tableMap, isLoading }: any) {
  const { setNodeRef } = useDroppable({ id: col.status });

  return (
    <div ref={setNodeRef} className="flex-1 flex flex-col border-r border-border bg-background min-w-[350px]">
      <div className="px-6 py-5 border-b border-border bg-surface-1 flex items-center justify-between flex-shrink-0 shadow-sm z-10">
        <span className={`font-mono text-xl tracking-widest font-black ${col.textClass} flex items-center gap-3`}>
          {col.label}
        </span>
        <span className={`font-mono text-lg px-4 py-1 rounded-full font-bold ${col.textClass} bg-${col.textClass.replace('text-', '')}/10 border border-${col.borderClass.replace('border-', '')}/30`}>
          {orders.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scrollable p-6 space-y-6">
        <SortableContext items={orders.map((o: any) => o.id)} strategy={verticalListSortingStrategy}>
          {isLoading && (
            <div className="font-mono text-lg text-muted animate-pulse p-6 tracking-widest text-center">
              LOADING...
            </div>
          )}
          {orders.map((o: any) => (
            <KitchenCard key={o.id} order={o} productMap={productMap} tableMap={tableMap} />
          ))}
          {!isLoading && orders.length === 0 && (
            <div className="py-24 flex flex-col items-center justify-center opacity-40">
              <span className="font-mono text-2xl text-muted tracking-widest font-bold">CLEAR</span>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const { data: allOrders = [], isLoading, dataUpdatedAt } = useOpenOrders();
  const { data: menu }   = useMenu();
  const { data: tables } = useTables();
  const updateStatus = useUpdateStatusMutation();

  const [activeId, setActiveId] = useState<string | null>(null);

  const productMap = useMemo(() => new Map<string, string>((menu?.products ?? []).map(p => [p.id, p.name])), [menu]);
  const tableMap = useMemo(() => new Map<string, string>((tables ?? []).map(t => [t.id, t.label])), [tables]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    const activeOrder = allOrders.find(o => o.id === active.id);
    if (!activeOrder) return;

    let newStatus: OrderStatus | null = null;
    if (COLUMNS.find(c => c.status === overId)) {
      newStatus = overId as OrderStatus;
    } else {
      const overOrder = allOrders.find(o => o.id === overId);
      if (overOrder) {
        newStatus = overOrder.status;
      }
    }

    if (newStatus && newStatus !== activeOrder.status) {
      updateStatus.mutate({ orderId: activeOrder.id, status: newStatus });
    }
  };

  const activeOrder = useMemo(() => allOrders.find(o => o.id === activeId), [activeId, allOrders]);

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-x-auto">
      <div className="flex items-center px-6 py-4 border-b border-border bg-surface-1 flex-shrink-0 shadow-sm z-20">
        <span className="font-mono text-xl font-black tracking-widest text-accent flex items-center gap-3">
          KITCHEN DISPLAY
        </span>
        <div className="flex items-center gap-3 ml-6">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
          </span>
          <span className="font-mono text-sm text-muted font-bold">
            {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN") : "—"}
          </span>
        </div>
      </div>

      <div className="flex-1 flex min-w-max">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {COLUMNS.map(col => {
            const orders = allOrders.filter(o => o.status === col.status);
            return (
              <Column key={col.status} col={col} orders={orders} productMap={productMap} tableMap={tableMap} isLoading={isLoading} />
            );
          })}
          
          <DragOverlay modifiers={[]}>
            {activeOrder ? (
              <KitchenCard order={activeOrder} productMap={productMap} tableMap={tableMap} isOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
