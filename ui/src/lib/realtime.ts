// ui/src/lib/realtime.ts
//
// Browser-side WebSocket client for the real-time push channel.
//
// Connects to the backend's /realtime endpoint after login and listens for
// push notifications. When one arrives ("something changed, go pull now"),
// it calls the registered invalidation listeners — the same listeners that
// useDevMockSync() uses — so kitchen/staff screens refetch immediately
// without waiting for the next polling interval.
//
// BROWSER COMPATIBILITY: uses the native browser WebSocket API (available
// in every modern browser, including the Tauri WebView). No polyfill or
// library needed. The ?token= query-param auth pattern is required because
// browsers cannot set custom headers on the WebSocket handshake.
//
// TAURI vs BROWSER: in Tauri production mode, the backend URL comes from
// the NEXT_PUBLIC_API_URL env var. In browser dev mode this points to the
// local backend (e.g. http://localhost:3001). When TAURI_BUILD=1 this
// module is included; in pure dev-mock mode the connection will fail to
// establish (no backend running) and that's fine — the BroadcastChannel
// layer from root cause 1 handles cross-tab sync in that case.

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001")
  .replace(/^https?/, "ws")   // http:// → ws://, https:// → wss://
  .replace(/^tauri:/, "ws:");  // tauri://localhost → ws://localhost

const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS  = 30_000;
const PING_INTERVAL_MS  = 25_000; // under any reasonable idle proxy timeout

type ChangeListener = () => void;
const changeListeners = new Set<ChangeListener>();

/**
 * Subscribe to receive a notification whenever the backend pushes a change
 * event. The same listener set that useDevMockSync() populates — so a single
 * subscription in queries.ts covers both the mock BroadcastChannel path
 * (dev, no backend) and the real WebSocket path (production / backend running).
 */
export function onRealtimeChange(listener: ChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyListeners() {
  for (const l of changeListeners) l();
}

// ── Connection lifecycle ────────────────────────────────────────────────────

interface RealtimeSession {
  token:    string;
  deviceId: string;
}

let _current: RealtimeSession | null = null;
let _socket:  WebSocket | null       = null;
let _pingTimer: ReturnType<typeof setInterval> | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _reconnectDelay = RECONNECT_BASE_MS;
let _intentionalClose = false;

/**
 * Call this right after a successful login to start the push connection.
 * Idempotent — calling again while already connected is a no-op unless the
 * token changed (session switch), in which case it reconnects.
 */
export function connectRealtime(token: string, deviceId: string): void {
  if (typeof window === "undefined") return; // SSR guard

  if (_current?.token === token && _socket?.readyState === WebSocket.OPEN) {
    return; // already connected with this session, nothing to do
  }

  _current = { token, deviceId };
  _intentionalClose = false;
  _startConnect();
}

/**
 * Call on logout. Cleanly closes the socket and stops reconnecting.
 */
export function disconnectRealtime(): void {
  _intentionalClose = true;
  _current = null;
  _teardown();
}

function _startConnect() {
  if (!_current) return;

  const url = `${API_BASE}/realtime?token=${encodeURIComponent(_current.token)}&deviceId=${encodeURIComponent(_current.deviceId)}`;

  try {
    _socket = new WebSocket(url);
  } catch {
    // URL malformed or WebSocket not available (SSR edge case)
    _scheduleReconnect();
    return;
  }

  _socket.addEventListener("open", () => {
    _reconnectDelay = RECONNECT_BASE_MS; // reset backoff on successful connect
    _startPing();
  });

  _socket.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.type === "order" || msg.type === "menu") {
        notifyListeners();
      }
      // "connected" and "pong" frames are intentionally ignored
    } catch {
      // "pong" is a raw string, not JSON — safe to ignore
    }
  });

  _socket.addEventListener("close", (event) => {
    _stopPing();
    // 4001 = auth rejected. Don't reconnect — credentials are invalid.
    if (event.code === 4001) {
      _intentionalClose = true;
      return;
    }
    if (!_intentionalClose) {
      _scheduleReconnect();
    }
  });

  _socket.addEventListener("error", () => {
    // The "close" event fires immediately after "error" for WebSocket — no
    // need to handle reconnect here; the close handler covers it.
  });
}

function _scheduleReconnect() {
  if (_intentionalClose || !_current) return;
  _reconnectTimer = setTimeout(() => {
    _startConnect();
    _reconnectDelay = Math.min(_reconnectDelay * 2, RECONNECT_MAX_MS);
  }, _reconnectDelay);
}

function _startPing() {
  _stopPing();
  _pingTimer = setInterval(() => {
    if (_socket?.readyState === WebSocket.OPEN) {
      _socket.send("ping");
    }
  }, PING_INTERVAL_MS);
}

function _stopPing() {
  if (_pingTimer !== null) {
    clearInterval(_pingTimer);
    _pingTimer = null;
  }
}

function _teardown() {
  _stopPing();
  if (_reconnectTimer !== null) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
  if (_socket) {
    _socket.close();
    _socket = null;
  }
}
