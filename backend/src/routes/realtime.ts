// src/routes/realtime.ts
//
// WS endpoint: a device connects once after login and gets pushed a tiny
// "something changed, go pull" message whenever another device on the same
// restaurant writes data. This is what turns the system from "wait up to
// 30s for the next poll" into "near-instant" for a kitchen display.
//
// Browsers cannot set custom headers on the WebSocket handshake request, so
// auth travels as a query param (?token=<jwt>) rather than an Authorization
// header. This is the standard workaround for browser-compatible WS auth —
// the JWT is still verified with the same verifyToken() used everywhere
// else, just read from a different place.
//
// @fastify/websocket v8 (the version compatible with Fastify v4) hands the
// handler a `SocketStream` (a Duplex wrapper), not the raw `ws` instance —
// the actual WebSocket lives at `connection.socket`.

import { FastifyInstance } from "fastify";
import type { SocketStream } from "@fastify/websocket";
import { verifyToken } from "../auth/auth.service.js";
import { registerClient } from "../realtime.js";

export async function realtimeRoutes(app: FastifyInstance) {
  app.get("/realtime", { websocket: true }, (connection: SocketStream, req) => {
    const socket = connection.socket;
    const query    = req.query as Record<string, string>;
    const token    = query.token;
    const deviceId = query.deviceId ?? "unknown-device";

    if (!token) {
      socket.close(4001, "Missing token");
      return;
    }

    let restaurantId: string;
    try {
      restaurantId = verifyToken(token).restaurantId;
    } catch {
      socket.close(4001, "Invalid token");
      return;
    }

    const unregister = registerClient(restaurantId, deviceId, socket);

    socket.send(JSON.stringify({ type: "connected", restaurantId, ts: Date.now() }));

    socket.on("close", () => {
      unregister();
    });

    socket.on("error", () => {
      unregister();
    });

    // Clients don't need to send anything — this is a server -> client push
    // channel only — but we still need a handler so dead sockets get cleaned
    // up. Anything they do send is ignored except a simple "ping" so devices
    // can keep the connection alive through idle-timeout proxies.
    socket.on("message", (raw: Buffer) => {
      if (raw.toString() === "ping") {
        socket.send("pong");
      }
    });
  });
}
