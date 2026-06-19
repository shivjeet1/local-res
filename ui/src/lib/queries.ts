// src/lib/queries.ts — all TanStack Query hooks

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ipc from "./ipc";
import { usePosStore } from "./store";

export const QK = {
  menu:        (rid: string) => ["menu", rid]           as const,
  openOrders:  (rid: string) => ["orders", "open", rid] as const,
  order:       (id: string)  => ["order", id]            as const,
  currentUser: ()            => ["currentUser"]           as const,
} as const;

/**
 * In dev/browser mode (no real Tauri backend) writes from *other* tabs are
 * only visible via ipc.ts's BroadcastChannel/localStorage bridge — React
 * Query has no way to know about them on its own. This hook subscribes to
 * that bridge and invalidates the open-orders/menu queries the moment another
 * tab changes something, instead of relying solely on refetchInterval.
 * In Tauri mode `onDevMockChange` is a no-op subscription (never fires),
 * so this is harmless on real hardware too — it's just inert there until
 * step 4 (push notifications from the sync backend) hooks into the same path.
 */
export function useDevMockSync() {
  const qc           = useQueryClient();
  const restaurantId = usePosStore((s) => s.restaurantId);

  useEffect(() => {
    if (!restaurantId) return;
    return ipc.onDevMockChange(() => {
      qc.invalidateQueries({ queryKey: QK.openOrders(restaurantId) });
      qc.invalidateQueries({ queryKey: QK.menu(restaurantId) });
    });
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
      // If store has user already (from login), use it immediately
      if (storeUser) return storeUser;
      // Otherwise try to restore from keychain/session
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
  const qc           = useQueryClient();
  const setUser      = usePosStore((s) => s.setUser);
  const setRestaurant = usePosStore((s) => s.setRestaurant);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      ipc.authUser(email, password),
    onSuccess: (user) => {
      setUser(user);
      setRestaurant(user.restaurantId);
      qc.setQueryData(QK.currentUser(), user);
    },
  });
}

export function useLogoutMutation() {
  const qc           = useQueryClient();
  const clearSession = usePosStore((s) => s.clearSession);

  return useMutation({
    mutationFn: ipc.logout,
    onSuccess: () => {
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
  const { restaurantId, deviceId } = usePosStore((s) => ({
    restaurantId: s.restaurantId ?? "",
    deviceId:     s.deviceId,
  }));
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (jwt: string) => ipc.triggerSync(restaurantId, deviceId, jwt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.menu(restaurantId) });
      qc.invalidateQueries({ queryKey: QK.openOrders(restaurantId) });
    },
  });
}
