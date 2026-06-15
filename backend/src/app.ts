// src/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { authRoutes }    from "./routes/auth.js";
import { menuRoutes }    from "./routes/menu.js";
import { orderRoutes }   from "./routes/orders.js";
import { syncRoutes }    from "./routes/sync.js";
import { adminRoutes }   from "./routes/admin.js";

export async function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  // ── Plugins ──────────────────────────────────────────────────────────────

  await app.register(cors, {
    // Desktop app uses Tauri custom protocol — CORS still required for dev
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? ["tauri://localhost"],
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
  });

  // ── Health ────────────────────────────────────────────────────────────────

  app.get("/health", async () => ({ status: "ok", ts: Date.now() }));

  // ── Routes ───────────────────────────────────────────────────────────────

  await app.register(authRoutes,  { prefix: "/auth" });
  await app.register(menuRoutes,  { prefix: "/menu" });
  await app.register(orderRoutes, { prefix: "/orders" });
  await app.register(syncRoutes,  { prefix: "/sync" });
  await app.register(adminRoutes, { prefix: "/admin" });

  // ── Global error handler ─────────────────────────────────────────────────

  app.setErrorHandler((err, _req, reply) => {
    const code = err.statusCode ?? 500;
    reply.code(code).send({
      success: false,
      error: code === 500 ? "Internal server error" : err.message,
    });
  });

  return app;
}

// ── Entry point ───────────────────────────────────────────────────────────

const app = await buildApp();
await app.listen({ port: Number(process.env.PORT ?? 4000), host: "0.0.0.0" });
console.log(`🔥 POS API running on :${process.env.PORT ?? 4000}`);
