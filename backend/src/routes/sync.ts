// src/routes/sync.ts
// Cloud side of the LWW sync engine.
// Push:  device POSTs dirty rows → cloud resolves conflicts → returns ACK
// Pull:  device GETs rows modified after its last checkpoint

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import { requireAuth } from "../auth/auth.service.js";
import { broadcastToRestaurant } from "../realtime.js";

// ── Shared row schemas ──────────────────────────────────────────────────────

const BaseRow = z.object({
  id:           z.string(),
  restaurantId: z.string(),
  createdAt:    z.number(),   // Unix ms from SQLite
  updatedAt:    z.number(),
  deletedAt:    z.number().nullable(),
});

const OrderRow = BaseRow.extend({
  tableId:       z.string().nullable(),
  userId:        z.string(),
  deviceId:      z.string(),
  status:        z.enum(["OPEN","SENT_TO_KITCHEN","READY","COMPLETED","VOIDED"]),
  notes:         z.string().nullable(),
  subtotalCents: z.number().int(),
  taxCents:      z.number().int(),
  totalCents:    z.number().int(),
  paidAt:        z.number().nullable(),
});

const OrderItemRow = BaseRow.extend({
  orderId:        z.string(),
  productId:      z.string(),
  deviceId:       z.string(),
  quantity:       z.number().int().positive(),
  unitPriceCents: z.number().int(),
  notes:          z.string().nullable(),
});

const ProductRow = BaseRow.extend({
  categoryId:   z.string().nullable(),
  name:         z.string(),
  description:  z.string().nullable(),
  priceCents:   z.number().int(),
  taxRatePct:   z.number(),
  isAvailable:  z.boolean(),
  imageUrl:     z.string().nullable(),
});

const PushSchema = z.object({
  deviceId:     z.string(),
  restaurantId: z.string(),
  orders:       z.array(OrderRow).default([]),
  orderItems:   z.array(OrderItemRow).default([]),
  products:     z.array(ProductRow).default([]),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

const msToDate = (ms: number | null) => ms ? new Date(ms) : null;

/** LWW: only update if incoming updatedAt > DB updatedAt */
async function lwwOrder(row: z.infer<typeof OrderRow>, restaurantId: string) {
  const existing = await prisma.order.findFirst({
    where: { id: row.id, restaurantId },
    select: { updatedAt: true },
  });

  const incomingMs = row.updatedAt;
  const existingMs = existing?.updatedAt.getTime() ?? 0;

  if (incomingMs <= existingMs) return { id: row.id, action: "skipped" as const };

  await prisma.order.upsert({
    where:  { id: row.id },
    create: {
      id:            row.id,
      restaurantId:  row.restaurantId,
      tableId:       row.tableId,
      userId:        row.userId,
      deviceId:      row.deviceId,
      status:        row.status,
      notes:         row.notes,
      subtotalCents: row.subtotalCents,
      taxCents:      row.taxCents,
      totalCents:    row.totalCents,
      paidAt:        msToDate(row.paidAt),
      createdAt:     new Date(row.createdAt),
      updatedAt:     new Date(row.updatedAt),
      deletedAt:     msToDate(row.deletedAt),
      syncedAt:      new Date(),
    },
    update: {
      status:        row.status,
      notes:         row.notes,
      subtotalCents: row.subtotalCents,
      taxCents:      row.taxCents,
      totalCents:    row.totalCents,
      paidAt:        msToDate(row.paidAt),
      updatedAt:     new Date(row.updatedAt),
      deletedAt:     msToDate(row.deletedAt),
      syncedAt:      new Date(),
    },
  });

  return { id: row.id, action: "written" as const };
}

async function lwwOrderItem(row: z.infer<typeof OrderItemRow>, restaurantId: string) {
  const existing = await prisma.orderItem.findFirst({
    where: { id: row.id, restaurantId },
    select: { updatedAt: true },
  });

  if (row.updatedAt <= (existing?.updatedAt.getTime() ?? 0)) {
    return { id: row.id, action: "skipped" as const };
  }

  await prisma.orderItem.upsert({
    where:  { id: row.id },
    create: {
      id:             row.id,
      restaurantId:   row.restaurantId,
      orderId:        row.orderId,
      productId:      row.productId,
      deviceId:       row.deviceId,
      quantity:       row.quantity,
      unitPriceCents: row.unitPriceCents,
      notes:          row.notes,
      createdAt:      new Date(row.createdAt),
      updatedAt:      new Date(row.updatedAt),
      deletedAt:      msToDate(row.deletedAt),
      syncedAt:       new Date(),
    },
    update: {
      quantity:       row.quantity,
      notes:          row.notes,
      updatedAt:      new Date(row.updatedAt),
      deletedAt:      msToDate(row.deletedAt),
      syncedAt:       new Date(),
    },
  });

  return { id: row.id, action: "written" as const };
}

async function lwwProduct(row: z.infer<typeof ProductRow>, restaurantId: string) {
  const existing = await prisma.product.findFirst({
    where: { id: row.id, restaurantId },
    select: { updatedAt: true },
  });

  if (row.updatedAt <= (existing?.updatedAt.getTime() ?? 0)) {
    return { id: row.id, action: "skipped" as const };
  }

  await prisma.product.upsert({
    where:  { id: row.id },
    create: {
      id:           row.id,
      restaurantId: row.restaurantId,
      categoryId:   row.categoryId,
      name:         row.name,
      description:  row.description,
      priceCents:   row.priceCents,
      taxRatePct:   row.taxRatePct,
      isAvailable:  row.isAvailable,
      imageUrl:     row.imageUrl,
      createdAt:    new Date(row.createdAt),
      updatedAt:    new Date(row.updatedAt),
      deletedAt:    msToDate(row.deletedAt),
    },
    update: {
      name:        row.name,
      description: row.description,
      priceCents:  row.priceCents,
      taxRatePct:  row.taxRatePct,
      isAvailable: row.isAvailable,
      imageUrl:    row.imageUrl,
      updatedAt:   new Date(row.updatedAt),
      deletedAt:   msToDate(row.deletedAt),
    },
  });

  return { id: row.id, action: "written" as const };
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function syncRoutes(app: FastifyInstance) {

  // POST /sync/push — device pushes dirty rows
  app.post("/push", { preHandler: requireAuth }, async (req, reply) => {
    const body = PushSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { restaurantId } = req.jwtPayload!;

    // Verify device isn't pushing for wrong restaurant
    if (body.data.restaurantId !== restaurantId) {
      return reply.code(403).send({ error: "Restaurant mismatch" });
    }

    const { orders, orderItems, products } = body.data;

    // Process all in parallel batches
    const [orderResults, itemResults, productResults] = await Promise.all([
      Promise.all(orders.map(r => lwwOrder(r, restaurantId))),
      Promise.all(orderItems.map(r => lwwOrderItem(r, restaurantId))),
      Promise.all(products.map(r => lwwProduct(r, restaurantId))),
    ]);

    const allResults = [...orderResults, ...itemResults, ...productResults];
    const syncedIds  = allResults.filter(r => r.action === "written").map(r => r.id);
    const conflictIds = allResults.filter(r => r.action === "skipped").map(r => r.id);

    // Update device last_seen_at
    await prisma.device.upsert({
      where:  { id: body.data.deviceId },
      create: { id: body.data.deviceId, restaurantId, label: body.data.deviceId, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });

    // Only nudge other devices if something was actually written — a push
    // with nothing new (e.g. an idle device's periodic sync) shouldn't
    // trigger every other terminal to pull for no reason.
    if (syncedIds.length > 0) {
      broadcastToRestaurant(restaurantId, "order", body.data.deviceId);
    }

    return reply.send({
      success: true,
      data: { syncedIds, conflictIds, serverTs: Date.now() },
    });
  });

  // GET /sync/pull?since=<unix_ms>&restaurantId=<id>
  // Returns all rows modified after `since` for this restaurant
  app.get("/pull", { preHandler: requireAuth }, async (req, reply) => {
    const query = req.query as Record<string, string>;
    const since = Number(query.since ?? 0);
    const { restaurantId } = req.jwtPayload!;

    if (isNaN(since)) return reply.code(400).send({ error: "Invalid since" });

    const sinceDate = new Date(since);

    const [orders, orderItems, products, categories] = await Promise.all([
      prisma.order.findMany({
        where:   { restaurantId, updatedAt: { gt: sinceDate } },
        include: { items: { where: { updatedAt: { gt: sinceDate } } } },
        orderBy: { updatedAt: "asc" },
        take:    500,
      }),
      prisma.orderItem.findMany({
        where:   { restaurantId, updatedAt: { gt: sinceDate } },
        orderBy: { updatedAt: "asc" },
        take:    1000,
      }),
      prisma.product.findMany({
        where:   { restaurantId, updatedAt: { gt: sinceDate } },
        orderBy: { updatedAt: "asc" },
        take:    200,
      }),
      prisma.category.findMany({
        where:   { restaurantId, updatedAt: { gt: sinceDate } },
        orderBy: { updatedAt: "asc" },
      }),
    ]);

    return reply.send({
      success: true,
      data: {
        orders,
        orderItems,
        products,
        categories,
        serverTs: Date.now(),
      },
    });
  });
}
