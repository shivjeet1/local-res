// src/lib/queries.ts — all TanStack Query hooks

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ipc from "./ipc";
import { usePosStore } from "./store";
import { onDevMockChange } from "./ipc";
import { connectRealtime, disconnectRealtime, onRealtimeChange } from "./realtime";

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
 *
 * The two paths cover complementary scenarios:
 *   - Dev/browser mode (no real backend): BroadcastChannel keeps all tabs in sync
 *   - Production Tauri: WebSocket push channel from the backend keeps all
 *     terminals in sync within ~1s of a write
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
      // Start the WebSocket push connection if we got a cloud JWT.
      // Falls back silently in dev-mock mode where token is null.
      if (token) {
        connectRealtime(token, deviceId);
      }
    },
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

// ── Tables ────────────────────────────────────────────────────────────────────

/**
 * Restaurant tables change rarely (added/renamed by an admin, not part of the
 * order flow), so this is cached aggressively — same staleTime as menu data.
 */
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
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.menu(restaurantId) }),
  });
}

export function useDeleteProductMutation() {
  const qc           = useQueryClient();
  const restaurantId = usePosStore((s) => s.restaurantId ?? "");
  return useMutation({
    mutationFn: (id: string) => ipc.deleteProduct(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QK.menu(restaurantId) }),
  });
}

// ── Orders ────────────────────────────────────────────────────────────────────

export function useOpenOrders() {
  const restaurantId = usePosStore((s) => s.restaurantId) ?? "";
  return useQuery({
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
    },
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
    },
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
    },
  });
}
