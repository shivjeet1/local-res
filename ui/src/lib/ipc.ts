// src/lib/ipc.ts
// Single file allowed to call invoke().
// Falls back to full mock when running outside Tauri (browser dev).

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(command, args);
  }
  return devMock<T>(command, args);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "STAFF" | "KITCHEN";

export interface User {
  id: string; restaurantId: string; name: string;
  email: string; role: UserRole;
  createdAt: number; updatedAt: number; deletedAt: number | null;
}

export type OrderStatus =
  | "OPEN" | "SENT_TO_KITCHEN" | "READY" | "COMPLETED" | "VOIDED";

export interface OrderItem {
  id: string; restaurantId: string; orderId: string; productId: string;
  deviceId: string; quantity: number; unitPriceCents: number;
  notes: string | null; createdAt: number; updatedAt: number;
  deletedAt: number | null; syncedAt: number | null;
}

export interface Order {
  id: string; restaurantId: string; tableId: string | null;
  userId: string; deviceId: string; status: OrderStatus;
  notes: string | null; subtotalCents: number; taxCents: number;
  totalCents: number; paidAt: number | null;
  createdAt: number; updatedAt: number;
  deletedAt: number | null; syncedAt: number | null;
  items: OrderItem[];
}

export interface Product {
  id: string; restaurantId: string; categoryId: string | null;
  name: string; description: string | null; priceCents: number;
  taxRatePct: number; isAvailable: boolean; imageUrl: string | null;
  createdAt: number; updatedAt: number; deletedAt: number | null;
}

export interface Category {
  id: string; restaurantId: string; name: string; sortOrder: number;
  createdAt: number; updatedAt: number; deletedAt: number | null;
}

export interface Menu { categories: Category[]; products: Product[]; }

export interface CreateProductPayload {
  name: string; categoryId?: string; description?: string;
  priceCents: number; taxRatePct?: number; imageUrl?: string;
}

export interface SyncResult { pushed: number; pulled: number; }

export interface AuthResult { user: User; token: string | null; }

// ── ApiResponse envelope ──────────────────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean; data: T | null; error: string | null;
  meta: { total: number | null; page: number | null } | null;
}

async function cmd<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const res = await invoke<ApiResponse<T>>(command, args ?? {});
  if (!res.success || res.data === null) {
    throw new Error(res.error ?? `Command '${command}' returned no data`);
  }
  return res.data;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const authUser       = (email: string, password: string) =>
  cmd<AuthResult>("auth_user", { payload: { email, password } });
export const getCurrentUser = () => cmd<User>("get_current_user");
export const logout         = () => cmd<void>("logout");

export const fetchMenu      = (restaurantId: string) =>
  cmd<Menu>("fetch_menu", { restaurantId });

export const createProduct  = (restaurantId: string, payload: CreateProductPayload) =>
  cmd<Product>("create_product", { restaurantId, payload });
export const deleteProduct  = (id: string) => cmd<void>("delete_product", { id });

export const listOpenOrders = (restaurantId: string) =>
  cmd<Order[]>("list_open_orders", { restaurantId });
export const getOrder       = (id: string) => cmd<Order>("get_order", { id });
export const saveOrderLocally = (
  restaurantId: string, userId: string, deviceId: string,
  payload: { tableId?: string; notes?: string }
) => cmd<Order>("save_order_locally", { restaurantId, userId, deviceId, payload });
export const addOrderItem   = (
  restaurantId: string, deviceId: string,
  payload: { orderId: string; productId: string; quantity: number; notes?: string }
) => cmd<Order>("add_order_item", { restaurantId, deviceId, payload });
export const removeOrderItem = (orderId: string, itemId: string) =>
  cmd<Order>("remove_order_item", { orderId, itemId });
export const updateOrderStatus = (orderId: string, status: OrderStatus) =>
  cmd<Order>("update_order_status", { payload: { orderId, status } });
export const voidOrder      = (orderId: string) => cmd<void>("void_order", { orderId });
export const triggerSync    = (restaurantId: string, deviceId: string, jwt: string) =>
  cmd<SyncResult>("trigger_sync", { restaurantId, deviceId, jwt });

export const centsToDisplay = (cents: number, currency = "₹"): string =>
  `${currency}${(cents / 100).toFixed(2)}`;

// ── Dev mock ──────────────────────────────────────────────────────────────────
//
// In browser-dev mode (no Tauri backend) this is the *only* thing standing in
// for the database. Each browser tab loads its own copy of this module, so any
// state declared as a plain `let`/module variable is private to that one tab —
// an order created in the "staff" tab would never be visible from "kitchen".
//
// Fix: back the mutable state with `localStorage` (shared by every tab on the
// same origin) and broadcast a message on every write via `BroadcastChannel` so
// other open tabs know to reload from storage immediately, instead of waiting
// on a `storage` event (which is unreliable cross-browser timing-wise and never
// fires in the *writing* tab itself).

const MOCK_RID = "mock_restaurant_01";
const MOCK_DID = "mock_device_01";
const ts       = () => Date.now();

const STORAGE_KEY   = "local_res_dev_mock_v1";
const CHANNEL_NAME  = "local_res_dev_mock";

// ── All seed users (matches backend/src/prisma/seed.ts) ──────────────────
const MOCK_USERS: (User & { password: string })[] = [
  {
    id: "mock_user_admin", restaurantId: MOCK_RID,
    name: "Admin", email: "admin@pos.dev", role: "ADMIN",
    password: "admin1234",
    createdAt: ts(), updatedAt: ts(), deletedAt: null,
  },
  {
    id: "mock_user_staff", restaurantId: MOCK_RID,
    name: "Staff One", email: "staff@pos.dev", role: "STAFF",
    password: "staff1234",
    createdAt: ts(), updatedAt: ts(), deletedAt: null,
  },
  {
    id: "mock_user_kitchen", restaurantId: MOCK_RID,
    name: "Kitchen", email: "kitchen@pos.dev", role: "KITCHEN",
    password: "kitchen1234",
    createdAt: ts(), updatedAt: ts(), deletedAt: null,
  },
];

// Static seed fixtures — never mutated in place, so these don't need to live
// in shared storage. Per-tab copies of these are fine because they're constant.
const SEED_CATEGORIES: Category[] = [
  { id: "cat1", restaurantId: MOCK_RID, name: "Starters",  sortOrder: 1, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "cat2", restaurantId: MOCK_RID, name: "Mains",     sortOrder: 2, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "cat3", restaurantId: MOCK_RID, name: "Drinks",    sortOrder: 3, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "cat4", restaurantId: MOCK_RID, name: "Desserts",  sortOrder: 4, createdAt: ts(), updatedAt: ts(), deletedAt: null },
];

const SEED_PRODUCTS: Product[] = [
  { id: "p1", restaurantId: MOCK_RID, categoryId: "cat1", name: "Garlic Bread",        priceCents: 18000, taxRatePct: 5,  isAvailable: true, description: null, imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "p2", restaurantId: MOCK_RID, categoryId: "cat1", name: "Soup of the Day",     priceCents: 22000, taxRatePct: 5,  isAvailable: true, description: null, imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "p3", restaurantId: MOCK_RID, categoryId: "cat1", name: "Bruschetta",          priceCents: 24000, taxRatePct: 5,  isAvailable: true, description: null, imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "p4", restaurantId: MOCK_RID, categoryId: "cat2", name: "Grilled Chicken",     priceCents: 52000, taxRatePct: 12, isAvailable: true, description: null, imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "p5", restaurantId: MOCK_RID, categoryId: "cat2", name: "Paneer Tikka Masala", priceCents: 42000, taxRatePct: 12, isAvailable: true, description: null, imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "p6", restaurantId: MOCK_RID, categoryId: "cat2", name: "Dal Makhani",         priceCents: 32000, taxRatePct: 12, isAvailable: true, description: null, imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "p7", restaurantId: MOCK_RID, categoryId: "cat2", name: "Fish & Chips",        priceCents: 58000, taxRatePct: 12, isAvailable: true, description: null, imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "p8", restaurantId: MOCK_RID, categoryId: "cat3", name: "Fresh Lime Soda",     priceCents:  8000, taxRatePct: 5,  isAvailable: true, description: null, imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "p9", restaurantId: MOCK_RID, categoryId: "cat3", name: "Masala Chai",         priceCents:  4000, taxRatePct: 5,  isAvailable: true, description: null, imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id:"p10", restaurantId: MOCK_RID, categoryId: "cat3", name: "Cold Coffee",         priceCents: 12000, taxRatePct: 5,  isAvailable: true, description: null, imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id:"p11", restaurantId: MOCK_RID, categoryId: "cat4", name: "Gulab Jamun",         priceCents: 14000, taxRatePct: 5,  isAvailable: true, description: null, imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id:"p12", restaurantId: MOCK_RID, categoryId: "cat4", name: "Brownie + Ice Cream", priceCents: 18000, taxRatePct: 5,  isAvailable: true, description: null, imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null },
];

// ── Shared, persisted, cross-tab mock state ────────────────────────────────
//
// Everything that can be mutated (session, orders, products — since
// create/delete product mutate this list) lives here and is read/written
// through `loadState`/`saveState` so every tab agrees on the same data.

interface MockState {
  session:  User | null;
  orders:   Order[];
  products: Product[];
}

function defaultState(): MockState {
  return { session: null, orders: [], products: [...SEED_PRODUCTS] };
}

function loadState(): MockState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<MockState>;
    return {
      session:  parsed.session  ?? null,
      orders:   parsed.orders   ?? [],
      products: parsed.products ?? [...SEED_PRODUCTS],
    };
  } catch {
    return defaultState();
  }
}

function saveState(state: MockState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage can throw in private-browsing / quota-exceeded cases.
    // Falling back to in-memory-only for this tab is better than crashing.
  }
  // Tell every other open tab "state changed, reload it" right away.
  // (A `storage` event also fires in other tabs, but BroadcastChannel is more
  // consistent across browsers and lets us notify listeners explicitly.)
  getChannel()?.postMessage({ type: "state-changed" });
}

let _channel: BroadcastChannel | null | undefined;
function getChannel(): BroadcastChannel | null {
  if (_channel !== undefined) return _channel;
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    _channel = null;
    return _channel;
  }
  _channel = new BroadcastChannel(CHANNEL_NAME);
  return _channel;
}

// In-memory cache of the current tab's view of state. Reloaded from
// localStorage on startup and whenever another tab signals a change.
let MOCK_STATE: MockState = loadState();

type MockChangeListener = () => void;
const changeListeners = new Set<MockChangeListener>();

/**
 * Subscribe to be notified whenever mock data changes — either because this
 * tab wrote something, or because another tab did and broadcast it. Wired
 * into TanStack Query (see queries.ts) so screens refetch immediately rather
 * than waiting for the next polling interval.
 */
export function onDevMockChange(listener: MockChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyListeners() {
  for (const l of changeListeners) l();
}

if (typeof window !== "undefined") {
  // Another tab wrote new state — reload ours and notify subscribers.
  getChannel()?.addEventListener("message", (e: MessageEvent) => {
    if (e.data?.type === "state-changed") {
      MOCK_STATE = loadState();
      notifyListeners();
    }
  });

  // Fallback/extra signal: native storage event (fires in *other* tabs only;
  // belt-and-suspenders alongside BroadcastChannel).
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      MOCK_STATE = loadState();
      notifyListeners();
    }
  });
}

/** Read-modify-write helper: pass a function that mutates the draft state. */
function mutate<R>(fn: (state: MockState) => R): R {
  const result = fn(MOCK_STATE);
  saveState(MOCK_STATE);
  notifyListeners();
  return result;
}

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null, meta: null };
}
function err(msg: string): ApiResponse<never> {
  return { success: false, data: null, error: msg, meta: null };
}
function makeId() {
  return `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function devMock<T>(command: string, args: any): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (v: any) => Promise.resolve(v as T);

  switch (command) {

    // ── Auth ────────────────────────────────────────────────────────────────
    case "auth_user": {
      const { email, password } = args?.payload ?? {};
      const found = MOCK_USERS.find(
        u => u.email === email?.toLowerCase().trim() && u.password === password
      );
      if (!found) return r(err("Invalid credentials"));
      const { password: _pw, ...safeUser } = found;
      mutate(s => { s.session = safeUser; });
      // No real backend JWT in dev-mock mode — token is null, realtime WS
      // connection simply won't establish (no backend running), which is fine
      // since the BroadcastChannel path handles cross-tab sync in this mode.
      return r(ok({ user: safeUser, token: null }));
    }

    case "get_current_user":
      return MOCK_STATE.session
        ? r(ok(MOCK_STATE.session))
        : r(err("No active session"));

    case "logout":
      mutate(s => { s.session = null; });
      return r(ok(undefined));

    // ── Menu ────────────────────────────────────────────────────────────────
    case "fetch_menu":
      return r(ok({
        categories: SEED_CATEGORIES.filter(c => !c.deletedAt),
        products:   MOCK_STATE.products.filter(p => !p.deletedAt),
      }));

    case "create_product": {
      const p = args?.payload as CreateProductPayload;
      const newP: Product = {
        id: makeId(), restaurantId: MOCK_RID,
        categoryId: p.categoryId ?? null, name: p.name,
        description: p.description ?? null, priceCents: p.priceCents,
        taxRatePct: p.taxRatePct ?? 0, isAvailable: true,
        imageUrl: null, createdAt: ts(), updatedAt: ts(), deletedAt: null,
      };
      mutate(s => { s.products.push(newP); });
      return r(ok(newP));
    }

    case "delete_product": {
      const found = mutate(s => {
        const p = s.products.find(p => p.id === args?.id);
        if (p) p.deletedAt = ts();
        return p ?? null;
      });
      return found ? r(ok(undefined)) : r(err("Product not found"));
    }

    // ── Orders ──────────────────────────────────────────────────────────────
    case "list_open_orders":
      return r(ok(
        MOCK_STATE.orders.filter(o => !["COMPLETED","VOIDED"].includes(o.status) && !o.deletedAt)
      ));

    case "get_order": {
      const o = MOCK_STATE.orders.find(o => o.id === args?.id);
      return o ? r(ok(o)) : r(err("Order not found"));
    }

    case "save_order_locally": {
      const userId = MOCK_STATE.session?.id ?? "mock_user_admin";
      const order: Order = {
        id: makeId(), restaurantId: MOCK_RID,
        tableId:  args?.payload?.tableId ?? null,
        userId, deviceId: MOCK_DID,
        status: "OPEN", notes: args?.payload?.notes ?? null,
        subtotalCents: 0, taxCents: 0, totalCents: 0,
        paidAt: null, createdAt: ts(), updatedAt: ts(),
        deletedAt: null, syncedAt: null, items: [],
      };
      mutate(s => { s.orders.push(order); });
      return r(ok({ ...order }));
    }

    case "add_order_item": {
      const { orderId, productId, quantity, notes } = args?.payload ?? {};
      const result = mutate(s => {
        const order = s.orders.find(o => o.id === orderId);
        if (!order) return { ok: false, error: "Order not found" } as const;
        const product = s.products.find(p => p.id === productId);
        if (!product) return { ok: false, error: "Product not found" } as const;

        const existing = order.items.find(i => i.productId === productId && !i.deletedAt);
        if (existing) {
          existing.quantity += quantity;
          existing.updatedAt = ts();
        } else {
          order.items.push({
            id: makeId(), restaurantId: MOCK_RID,
            orderId, productId, deviceId: MOCK_DID,
            quantity, unitPriceCents: product.priceCents,
            notes: notes ?? null, createdAt: ts(), updatedAt: ts(),
            deletedAt: null, syncedAt: null,
          });
        }
        recalcTotals(order, s.products);
        return { ok: true, order: { ...order, items: [...order.items] } } as const;
      });
      return result.ok ? r(ok(result.order)) : r(err(result.error));
    }

    case "remove_order_item": {
      const { orderId, itemId } = args ?? {};
      const result = mutate(s => {
        const order = s.orders.find(o => o.id === orderId);
        if (!order) return { ok: false, error: "Order not found" } as const;
        const item = order.items.find(i => i.id === itemId);
        if (item) item.deletedAt = ts();
        recalcTotals(order, s.products);
        return { ok: true, order: { ...order, items: [...order.items] } } as const;
      });
      return result.ok ? r(ok(result.order)) : r(err(result.error));
    }

    case "update_order_status": {
      const { orderId, status } = args?.payload ?? {};
      const result = mutate(s => {
        const order = s.orders.find(o => o.id === orderId);
        if (!order) return { ok: false, error: "Order not found" } as const;
        order.status    = status;
        order.updatedAt = ts();
        if (status === "COMPLETED") order.paidAt = ts();
        return { ok: true, order: { ...order, items: [...order.items] } } as const;
      });
      return result.ok ? r(ok(result.order)) : r(err(result.error));
    }

    case "void_order": {
      mutate(s => {
        const order = s.orders.find(o => o.id === args?.orderId);
        if (order) { order.status = "VOIDED"; order.deletedAt = ts(); }
      });
      return r(ok(undefined));
    }

    case "trigger_sync":
      return r(ok({ pushed: 0, pulled: 0 }));

    default:
      return r(err(`Unknown command: ${command}`));
  }
}

function recalcTotals(order: Order, products: Product[]) {
  const active = order.items.filter(i => !i.deletedAt);
  order.subtotalCents = active.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  order.taxCents = active.reduce((s, i) => {
    const p = products.find(p => p.id === i.productId);
    return s + Math.floor(i.unitPriceCents * i.quantity * (p?.taxRatePct ?? 0) / 100);
  }, 0);
  order.totalCents = order.subtotalCents + order.taxCents;
}
