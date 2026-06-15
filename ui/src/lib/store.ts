// src/lib/store.ts
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "./ipc";

// ── Session ───────────────────────────────────────────────────────────────────

interface SessionSlice {
  user:         User | null;
  restaurantId: string | null;
  deviceId:     string;
  setUser:        (u: User | null) => void;
  setRestaurant:  (id: string) => void;
  clearSession:   () => void;
}

// ── Draft order ───────────────────────────────────────────────────────────────

interface DraftItem {
  productId:  string;
  name:       string;
  priceCents: number;
  quantity:   number;
  notes?:     string;
}

interface OrderDraftSlice {
  draftTableId:   string | null;
  draftItems:     DraftItem[];
  setDraftTable:  (tableId: string | null) => void;
  addDraftItem:   (item: DraftItem) => void;
  removeDraftItem:(productId: string) => void;
  updateDraftQty: (productId: string, qty: number) => void;
  clearDraft:     () => void;
  draftTotal:     () => number;
}

// ── UI ────────────────────────────────────────────────────────────────────────

interface UiSlice {
  sidebarOpen:   boolean;
  activeOrderId: string | null;
  toggleSidebar:  () => void;
  setActiveOrder: (id: string | null) => void;
}

type PosStore = SessionSlice & OrderDraftSlice & UiSlice;

function generateDeviceId(): string {
  if (typeof window === "undefined") return "ssr_device";
  try {
    const stored = sessionStorage.getItem("__device_id");
    if (stored) return stored;
    const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("__device_id", id);
    return id;
  } catch {
    return `dev_${Date.now()}`;
  }
}

export const usePosStore = create<PosStore>()(
  persist(
    (set, get) => ({
      // Session
      user:         null,
      restaurantId: null,
      deviceId:     generateDeviceId(),
      setUser:        (user)         => set({ user }),
      setRestaurant:  (restaurantId) => set({ restaurantId }),
      clearSession:   ()             => set({ user: null, restaurantId: null, draftItems: [] }),

      // Draft
      draftTableId: null,
      draftItems:   [],
      setDraftTable: (draftTableId) => set({ draftTableId }),

      addDraftItem: (item) =>
        set((s) => {
          const existing = s.draftItems.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              draftItems: s.draftItems.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            };
          }
          return { draftItems: [...s.draftItems, item] };
        }),

      removeDraftItem: (productId) =>
        set((s) => ({ draftItems: s.draftItems.filter((i) => i.productId !== productId) })),

      updateDraftQty: (productId, qty) =>
        set((s) => ({
          draftItems: qty <= 0
            ? s.draftItems.filter((i) => i.productId !== productId)
            : s.draftItems.map((i) =>
                i.productId === productId ? { ...i, quantity: qty } : i
              ),
        })),

      clearDraft: () => set({ draftItems: [], draftTableId: null }),

      draftTotal: () =>
        get().draftItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),

      // UI
      sidebarOpen:    true,
      activeOrderId:  null,
      toggleSidebar:  () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setActiveOrder: (activeOrderId) => set({ activeOrderId }),
    }),
    {
      name:    "pos-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : {
          getItem:    () => null,
          setItem:    () => {},
          removeItem: () => {},
        }
      ),
      partialize: (s) => ({
        restaurantId: s.restaurantId,
        deviceId:     s.deviceId,
      }),
    }
  )
);
