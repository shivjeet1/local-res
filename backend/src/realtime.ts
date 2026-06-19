// src/realtime.ts
//
// Step 4 of the multi-device fix: a push channel so other terminals pull
// immediately instead of waiting on their own 30s timer.
//
// This is intentionally a thin notify-only layer — it does NOT carry the
// actual order/menu data over the socket. A connected device just receives
// "something changed for your restaurant, go pull now" and is expected to
// call /sync/pull (Tauri) or invalidate its query cache (browser dev mode).
// Keeping the payload tiny means we don't have to worry about the socket
// being a second source of truth that can drift from SQLite/Postgres — it's
// purely a low-latency nudge on top of the existing pull-based sync engine.

import type { WebSocket } from "ws";

export type RealtimeEventType = "order" | "menu";

export interface RealtimeMessage {
  type:          RealtimeEventType;
  restaurantId:  string;
  // The device that caused the change, if any — included so a device can
  // skip redundant self-triggered pulls if it wants to (not required).
  originDeviceId?: string;
  ts:            number;
}

interface ConnectedClient {
  socket:   WebSocket;
  deviceId: string;
}

// restaurantId -> connected clients for that restaurant
const restaurantClients = new Map<string, Set<ConnectedClient>>();

export function registerClient(
  restaurantId: string,
  deviceId: string,
  socket: WebSocket
): () => void {
  const client: ConnectedClient = { socket, deviceId };
  if (!restaurantClients.has(restaurantId)) {
    restaurantClients.set(restaurantId, new Set());
  }
  restaurantClients.get(restaurantId)!.add(client);

  // Returns an unregister function for the caller's close handler.
  return () => {
    const set = restaurantClients.get(restaurantId);
    if (!set) return;
    set.delete(client);
    if (set.size === 0) restaurantClients.delete(restaurantId);
  };
}

/**
 * Notify every connected device for a restaurant that something changed.
 * Safe to call even if no devices are connected (no-op).
 */
export function broadcastToRestaurant(
  restaurantId: string,
  type: RealtimeEventType,
  originDeviceId?: string
): number {
  const set = restaurantClients.get(restaurantId);
  if (!set || set.size === 0) return 0;

  const message: RealtimeMessage = {
    type,
    restaurantId,
    originDeviceId,
    ts: Date.now(),
  };
  const payload = JSON.stringify(message);

  let sent = 0;
  for (const client of set) {
    // readyState 1 === OPEN. Stale/closing sockets are skipped rather than
    // throwing — connection cleanup happens via the route's close handler.
    if (client.socket.readyState === 1) {
      client.socket.send(payload);
      sent++;
    }
  }
  return sent;
}

/** Test/debug helper — number of connections currently tracked for a restaurant. */
export function connectionCount(restaurantId: string): number {
  return restaurantClients.get(restaurantId)?.size ?? 0;
}

/** Test/debug helper — clears all tracked connections. Used by test teardown. */
export function _resetForTests(): void {
  restaurantClients.clear();
}
