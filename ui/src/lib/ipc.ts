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
  cmd<User>("auth_user", { payload: { email, password } });
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

const MOCK_RID = "mock_restaurant_01";
const MOCK_DID = "mock_device_01";
const ts       = () => Date.now();

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

let MOCK_SESSION: User | null = null;

const MOCK_CATEGORIES: Category[] = [
  { id: "cat1", restaurantId: MOCK_RID, name: "Starters",  sortOrder: 1, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "cat2", restaurantId: MOCK_RID, name: "Mains",     sortOrder: 2, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "cat3", restaurantId: MOCK_RID, name: "Drinks",    sortOrder: 3, createdAt: ts(), updatedAt: ts(), deletedAt: null },
  { id: "cat4", restaurantId: MOCK_RID, name: "Desserts",  sortOrder: 4, createdAt: ts(), updatedAt: ts(), deletedAt: null },
];

const MOCK_PRODUCTS: Product[] = [
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

let MOCK_ORDERS: Order[] = [];

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
function devMock<T>(command: string, args: any): Promise<ApiResponse<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (v: any) => Promise.resolve(v as ApiResponse<T>);

  switch (command) {

    // ── Auth ────────────────────────────────────────────────────────────────
    case "auth_user": {
      const { email, password } = args?.payload ?? {};
      const found = MOCK_USERS.find(
        u => u.email === email?.toLowerCase().trim() && u.password === password
      );
      if (!found) return r(err("Invalid credentials"));
      const { password: _pw, ...safeUser } = found;
      MOCK_SESSION = safeUser;
      return r(ok(safeUser));
    }

    case "get_current_user":
      return MOCK_SESSION
        ? r(ok(MOCK_SESSION))
        : r(err("No active session"));

    case "logout":
      MOCK_SESSION = null;
      return r(ok(undefined));

    // ── Menu ────────────────────────────────────────────────────────────────
    case "fetch_menu":
      return r(ok({
        categories: MOCK_CATEGORIES.filter(c => !c.deletedAt),
        products:   MOCK_PRODUCTS.filter(p => !p.deletedAt),
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
      MOCK_PRODUCTS.push(newP);
      return r(ok(newP));
    }

    case "delete_product": {
      const idx = MOCK_PRODUCTS.findIndex(p => p.id === args?.id);
      if (idx >= 0) MOCK_PRODUCTS[idx]!.deletedAt = ts();
      return r(ok(undefined));
    }

    // ── Orders ──────────────────────────────────────────────────────────────
    case "list_open_orders":
      return r(ok(
        MOCK_ORDERS.filter(o => !["COMPLETED","VOIDED"].includes(o.status) && !o.deletedAt)
      ));

    case "get_order": {
      const o = MOCK_ORDERS.find(o => o.id === args?.id);
      return o ? r(ok(o)) : r(err("Order not found"));
    }

    case "save_order_locally": {
      const userId = MOCK_SESSION?.id ?? "mock_user_admin";
      const order: Order = {
        id: makeId(), restaurantId: MOCK_RID,
        tableId:  args?.payload?.tableId ?? null,
        userId, deviceId: MOCK_DID,
        status: "OPEN", notes: args?.payload?.notes ?? null,
        subtotalCents: 0, taxCents: 0, totalCents: 0,
        paidAt: null, createdAt: ts(), updatedAt: ts(),
        deletedAt: null, syncedAt: null, items: [],
      };
      MOCK_ORDERS.push(order);
      return r(ok({ ...order }));
    }

    case "add_order_item": {
      const { orderId, productId, quantity, notes } = args?.payload ?? {};
      const order = MOCK_ORDERS.find(o => o.id === orderId);
      if (!order) return r(err("Order not found"));
      const product = MOCK_PRODUCTS.find(p => p.id === productId);
      if (!product) return r(err("Product not found"));

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
      recalcTotals(order);
      return r(ok({ ...order, items: [...order.items] }));
    }

    case "remove_order_item": {
      const { orderId, itemId } = args ?? {};
      const order = MOCK_ORDERS.find(o => o.id === orderId);
      if (!order) return r(err("Order not found"));
      const item = order.items.find(i => i.id === itemId);
      if (item) item.deletedAt = ts();
      recalcTotals(order);
      return r(ok({ ...order, items: [...order.items] }));
    }

    case "update_order_status": {
      const { orderId, status } = args?.payload ?? {};
      const order = MOCK_ORDERS.find(o => o.id === orderId);
      if (!order) return r(err("Order not found"));
      order.status    = status;
      order.updatedAt = ts();
      if (status === "COMPLETED") order.paidAt = ts();
      return r(ok({ ...order, items: [...order.items] }));
    }

    case "void_order": {
      const order = MOCK_ORDERS.find(o => o.id === args?.orderId);
      if (order) { order.status = "VOIDED"; order.deletedAt = ts(); }
      return r(ok(undefined));
    }

    case "trigger_sync":
      return r(ok({ pushed: 0, pulled: 0 }));

    default:
      return r(err(`Unknown command: ${command}`));
  }
}

function recalcTotals(order: Order) {
  const active = order.items.filter(i => !i.deletedAt);
  order.subtotalCents = active.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  order.taxCents = active.reduce((s, i) => {
    const p = MOCK_PRODUCTS.find(p => p.id === i.productId);
    return s + Math.floor(i.unitPriceCents * i.quantity * (p?.taxRatePct ?? 0) / 100);
  }, 0);
  order.totalCents = order.subtotalCents + order.taxCents;
}
