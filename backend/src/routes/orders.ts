// src/routes/orders.ts
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import { requireAuth, requireRole } from "../auth/auth.service.js";
import { createId } from "@paralleldrive/cuid2";

const OrderStatusSchema = z.enum(["OPEN","SENT_TO_KITCHEN","READY","COMPLETED","VOIDED"]);

const CreateOrderSchema = z.object({
  id:       z.string(),          // CUID2 from device
  tableId:  z.string().optional(),
  deviceId: z.string(),
  notes:    z.string().optional(),
  items: z.array(z.object({
    id:            z.string(),
    productId:     z.string(),
    quantity:      z.number().int().positive(),
    unitPriceCents: z.number().int().nonnegative(),
    notes:         z.string().optional(),
  })).min(1),
});

export async function orderRoutes(app: FastifyInstance) {
  // GET /orders — open orders for this restaurant
  app.get("/", { preHandler: requireAuth }, async (req, reply) => {
    const { restaurantId } = req.jwtPayload!;
    const orders = await prisma.order.findMany({
      where:   { restaurantId, deletedAt: null, status: { notIn: ["COMPLETED","VOIDED"] } },
      include: { items: { where: { deletedAt: null }, include: { product: true } }, table: true },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ success: true, data: orders });
  });

  // GET /orders/:id
  app.get("/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { restaurantId } = req.jwtPayload!;
    const order = await prisma.order.findFirst({
      where:   { id, restaurantId, deletedAt: null },
      include: { items: { where: { deletedAt: null }, include: { product: true } }, table: true },
    });
    if (!order) return reply.code(404).send({ error: "Not found" });
    return reply.send({ success: true, data: order });
  });

  // POST /orders — STAFF/ADMIN create
  app.post("/", { preHandler: requireRole("ADMIN","STAFF") }, async (req, reply) => {
    const body = CreateOrderSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { restaurantId, sub: userId } = req.jwtPayload!;
    const { id, tableId, deviceId, notes, items } = body.data;

    // Verify all products belong to this restaurant
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, restaurantId, deletedAt: null },
    });
    if (products.length !== productIds.length) {
      return reply.code(400).send({ error: "Invalid product(s)" });
    }

    // Calculate totals server-side (never trust client)
    const productMap = new Map(products.map(p => [p.id, p]));
    let subtotal = 0, tax = 0;
    for (const item of items) {
      const p = productMap.get(item.productId)!;
      const lineTotal = p.priceCents * item.quantity;
      subtotal += lineTotal;
      tax += Math.floor(lineTotal * p.taxRatePct / 100);
    }

    const order = await prisma.order.create({
      data: {
        id, restaurantId, tableId, userId, deviceId, 
        notes: notes ?? null, // <-- FIX: Strict null mapping
        subtotalCents: subtotal,
        taxCents:      tax,
        totalCents:    subtotal + tax,
        syncedAt:      new Date(),
        items: {
          create: items.map(item => ({
            id:            item.id,
            restaurantId,
            product:       { connect: { id: item.productId } }, // <-- FIX: Prisma relation syntax
            deviceId,
            quantity:      item.quantity,
            unitPriceCents: productMap.get(item.productId)!.priceCents,
            notes:         item.notes ?? null, // <-- FIX: Strict null mapping
            syncedAt:      new Date(),
          })),
        },
      },
      include: { items: true },
    });

    return reply.code(201).send({ success: true, data: order });
  });

  // PATCH /orders/:id/status — KITCHEN can update, ADMIN/STAFF can void
  app.patch("/:id/status", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { restaurantId, role } = req.jwtPayload!;
    const body = z.object({ status: OrderStatusSchema }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { status } = body.data;

    // RBAC: kitchen can only move to READY; cannot void
    if (role === "KITCHEN" && !["READY"].includes(status)) {
      return reply.code(403).send({ error: "Kitchen can only mark orders READY" });
    }
    if (role === "STAFF" && status === "VOIDED") {
      return reply.code(403).send({ error: "Only ADMIN can void orders" });
    }

    const updated = await prisma.order.updateMany({
      where: { id, restaurantId, deletedAt: null },
      data: {
        status,
        paidAt:   status === "COMPLETED" ? new Date() : null, // <-- FIX: Changed undefined to null
        syncedAt: new Date(),
      },
    });
    if (updated.count === 0) return reply.code(404).send({ error: "Not found" });
    return reply.send({ success: true });
  });

  // DELETE /orders/:id — soft delete (ADMIN only)
  app.delete("/:id", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { restaurantId } = req.jwtPayload!;
    await prisma.$transaction([
      prisma.orderItem.updateMany({
        where: { orderId: id, restaurantId },
        data:  { deletedAt: new Date() },
      }),
      prisma.order.updateMany({
        where: { id, restaurantId },
        data:  { deletedAt: new Date(), status: "VOIDED" },
      }),
    ]);
    return reply.send({ success: true });
  });
}
