// src/lib/queries.ts — all TanStack Query hooks

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ipc from "./ipc";
import { usePosStore } from "./store";
import { onDevMockChange } from "./ipc";
import { connectRealtime, disconnectRealtime, onRealtimeChange, onOrderReady } from "./realtime";
import { toast } from "./toast";

export const QK = {
  menu:        (rid: string) => ["menu", rid]           as const,
  tables:      (rid: string) => ["tables", rid]          as const,
  openOrders:  (rid: string) => ["orders", "open", rid] as const,
  order:       (id: string)  => ["order", id]            as const,
  currentUser: ()            => ["currentUser"]           as const,
} as const;

/**
 * Subscribes to both cross-tab mock changes (BroadcastChannel, dev mode) and
 * real-time backend push notifications (WebSocket, production) and invalidates
 * the open-orders/menu queries immediately when either fires.
 */
export function useDevMockSync() {
  const qc           = useQueryClient();
  const restaurantId = usePosStore((s) => s.restaurantId);

  useEffect(() => {
    if (!restaurantId) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: QK.openOrders(restaurantId) });
      qc.invalidateQueries({ queryKey: QK.menu(restaurantId) });
    };
    const unsubMock     = onDevMockChange(invalidate);
    const unsubRealtime = onRealtimeChange(invalidate);
    return () => { unsubMock(); unsubRealtime(); };
  }, [qc, restaurantId]);
}

/**
 * Fires `onReady()` whenever the backend pushes an "order_ready" event
 */
export function useOrderReadyNotification(onReady: () => void) {
  useEffect(() => {
    return onOrderReady(onReady);
  }, [onReady]);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function useCurrentUser() {
  const storeUser    = usePosStore((s) => s.user);
  const setUser      = usePosStore((s) => s.setUser);
  const setRestaurant = usePosStore((s) => s.setRestaurant);

  return useQuery({
    queryKey: QK.currentUser(),
    queryFn:  async () => {
      if (storeUser) return storeUser;
      const user = await ipc.getCurrentUser();
      setUser(user);
      setRestaurant(user.restaurantId);
      return user;
    },
    retry:     false,
    staleTime: Infinity,
  });
}

export function useLoginMutation() {
  const qc            = useQueryClient();
  const setUser       = usePosStore((s) => s.setUser);
  const setRestaurant = usePosStore((s) => s.setRestaurant);
  const setJwt        = usePosStore((s) => s.setJwt);
  const deviceId      = usePosStore((s) => s.deviceId);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      ipc.authUser(email, password),
    onSuccess: ({ user, token }) => {
      setUser(user);
      setRestaurant(user.restaurantId);
      setJwt(token);
      qc.setQueryData(QK.currentUser(), user);
      if (token) connectRealtime(token, deviceId);
      toast.success(`Welcome back, ${user.email}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Login failed");
    }
  });
}

export function useLogoutMutation() {
  const qc           = useQueryClient();
  const clearSession = usePosStore((s) => s.clearSession);

  return useMutation({
    mutationFn: ipc.logout,
    onSuccess: () => {
      disconnectRealtime();
      clearSession();
      qc.clear();
      toast.info("Logged out successfully");
    },
  });
}

// ── Menu ──────────────────────────────────────────────────────────────────────

export function useMenu() {
  const restaurantId = usePosStore((s) => s.restaurantId) ?? "";
  return useQuery({
    queryKey:  QK.menu(restaurantId),
    queryFn:   () => ipc.fetchMenu(restaurantId),
    enabled:   !!restaurantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTables() {
  const restaurantId = usePosStore((s) => s.restaurantId) ?? "";
  return useQuery({
    queryKey:  QK.tables(restaurantId),
    queryFn:   () => ipc.fetchTables(restaurantId),
    enabled:   !!restaurantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateProductMutation() {
  const qc           = useQueryClient();
  const restaurantId = usePosStore((s) => s.restaurantId ?? "");
  return useMutation({
    mutationFn: (payload: ipc.CreateProductPayload) =>
      ipc.createProduct(restaurantId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.menu(restaurantId) });
      toast.success("Product created successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create product")
  });
}

export function useDeleteProductMutation() {
  const qc           = useQueryClient();
  const restaurantId = usePosStore((s) => s.restaurantId ?? "");
  return useMutation({
    mutationFn: (id: string) => ipc.deleteProduct(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: QK.menu(restaurantId) });
      toast.info("Product deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete product")
  });
}

// ── Orders ────────────────────────────────────────────────────────────────────

export function useOpenOrders() {
  const restaurantId = usePosStore((s) => s.restaurantId) ?? "";
  return useQuery<ipc.Order[]>({
    queryKey:        QK.openOrders(restaurantId),
    queryFn:         () => ipc.listOpenOrders(restaurantId),
    enabled:         !!restaurantId,
    refetchInterval: 10_000,
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: QK.order(id ?? ""),
    queryFn:  () => ipc.getOrder(id!),
    enabled:  !!id,
  });
}

export function useCreateOrderMutation() {
  const qc = useQueryClient();
  const { restaurantId, user, deviceId } = usePosStore((s) => ({
    restaurantId: s.restaurantId ?? "",
    user:         s.user,
    deviceId:     s.deviceId,
  }));

  return useMutation({
    mutationFn: (payload: { tableId?: string; notes?: string }) => {
      if (!user) throw new Error("Not logged in");
      return ipc.saveOrderLocally(restaurantId, user.id, deviceId, payload);
    },
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: QK.openOrders(restaurantId) });
      qc.setQueryData(QK.order(order.id), order);
      toast.success("New order created");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create order")
  });
}

export function useAddItemMutation() {
  const qc = useQueryClient();
  const { restaurantId, deviceId } = usePosStore((s) => ({
    restaurantId: s.restaurantId ?? "",
    deviceId:     s.deviceId,
  }));

  return useMutation({
    mutationFn: (payload: {
      orderId: string; productId: string; quantity: number; notes?: string;
    }) => ipc.addOrderItem(restaurantId, deviceId, payload),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: QK.openOrders(restaurantId) });
      qc.setQueryData(QK.order(order.id), order);
    },
    onError: (err: any) => toast.error(err.message || "Failed to add item")
  });
}

export function useRemoveItemMutation() {
  const qc           = useQueryClient();
  const restaurantId = usePosStore((s) => s.restaurantId ?? "");

  return useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      ipc.removeOrderItem(orderId, itemId),
    onSuccess: (order) => {
      qc.setQueryData(QK.order(order.id), order);
      qc.invalidateQueries({ queryKey: QK.openOrders(restaurantId) });
    },
  });
}

export function useUpdateStatusMutation() {
  const qc           = useQueryClient();
  const restaurantId = usePosStore((s) => s.restaurantId ?? "");

  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: ipc.OrderStatus }) =>
      ipc.updateOrderStatus(orderId, status),
    onSuccess: (order) => {
      qc.setQueryData(QK.order(order.id), order);
      qc.invalidateQueries({ queryKey: QK.openOrders(restaurantId) });
      toast.success(`Order status updated to ${order.status.replace(/_/g, " ")}`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status")
  });
}

export function useToggleGstMutation() {
  const qc           = useQueryClient();
  const restaurantId = usePosStore((s) => s.restaurantId ?? "");

  return useMutation({
    mutationFn: ({ orderId, applyGst }: { orderId: string; applyGst: boolean }) =>
      ipc.toggleOrderGst(orderId, applyGst),
    onSuccess: (order) => {
      qc.setQueryData(QK.order(order.id), order);
      qc.invalidateQueries({ queryKey: QK.openOrders(restaurantId) });
      toast.info(`GST ${order.applyGst ? "applied" : "removed"}`);
    },
  });
}

export function useVoidOrderMutation() {
  const qc           = useQueryClient();
  const restaurantId = usePosStore((s) => s.restaurantId ?? "");

  return useMutation({
    mutationFn: ipc.voidOrder,
    onSuccess: (_, orderId) => {
      qc.removeQueries({ queryKey: QK.order(orderId) });
      qc.invalidateQueries({ queryKey: QK.openOrders(restaurantId) });
      toast.info("Order voided successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to void order")
  });
}

export function useSyncMutation() {
  const { restaurantId, deviceId, jwt } = usePosStore((s) => ({
    restaurantId: s.restaurantId ?? "",
    deviceId:     s.deviceId,
    jwt:          s.jwt ?? "",
  }));
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => ipc.triggerSync(restaurantId, deviceId, jwt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.menu(restaurantId) });
      qc.invalidateQueries({ queryKey: QK.openOrders(restaurantId) });
      toast.success("Sync completed");
    },
    onError: (err: any) => toast.error(err.message || "Sync failed")
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export function useDashboardReport() {
  const jwt = usePosStore((s) => s.jwt);
  return useQuery({
    queryKey: ["dashboardReport"],
    queryFn: () => ipc.fetchDashboardReport(jwt!),
    enabled: !!jwt,
  });
}

export function useDailyReport(date?: string) {
  const jwt = usePosStore((s) => s.jwt ?? "");
  return useQuery({
    queryKey:  ["admin", "report", date ?? "today"],
    queryFn:   () => ipc.fetchDailyReport(jwt, date),
    refetchInterval: 60_000,
  });
}

export function useAdminUsers() {
  const jwt = usePosStore((s) => s.jwt ?? "");
  return useQuery({
    queryKey:  ["admin", "users"],
    queryFn:   () => ipc.listAdminUsers(jwt),
    staleTime: 60_000,
  });
}

export function useDeleteUserMutation() {
  const jwt = usePosStore((s) => s.jwt ?? "");
  const qc  = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => ipc.deleteAdminUser(jwt, userId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User deleted successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete user")
  });
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  const { jwt } = usePosStore();
  
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window) ? `${window.location.protocol}//${window.location.hostname}:4000` : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to create user");
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User created successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create user")
  });
}
