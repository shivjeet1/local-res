import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import { requireAuth } from "../auth/auth.service.js";
import { createId } from "@paralleldrive/cuid2";
import { broadcastToRestaurant } from "../realtime.js";

const RpcSchema = z.object({
  command: z.string(),
  args: z.any(),
});

export async function rpcRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const body = RpcSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { command, args } = body.data;
    const { restaurantId, sub: userId } = req.jwtPayload!;

    async function recalcTotals(orderId: string) {
      const order = await prisma.order.findUnique({
        where: { id: orderId, restaurantId },
        include: { items: { where: { deletedAt: null }, include: { product: true } } }
      });
      if (!order) return null;

      let subtotal = 0;
      let tax = 0;
      for (const item of order.items) {
        const lineTotal = item.unitPriceCents * item.quantity;
        subtotal += lineTotal;
        if (order.applyGst) {
          tax += Math.floor(lineTotal * item.product.taxRatePct / 100);
        }
      }
      
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { subtotalCents: subtotal, taxCents: tax, totalCents: subtotal + tax, updatedAt: new Date(), syncedAt: new Date() },
        include: { items: { where: { deletedAt: null }, include: { product: true } }, table: true }
      });
      
      broadcastToRestaurant(restaurantId, "order", order.deviceId);
      return updated;
    }

    try {
      switch (command) {
        case "save_order_locally": {
          const { deviceId, payload } = args;
          const order = await prisma.order.create({
            data: {
              id: createId(),
              restaurantId,
              tableId: payload?.tableId ?? null,
              userId,
              deviceId,
              status: "OPEN",
              notes: payload?.notes ?? null,
              applyGst: true,
              subtotalCents: 0, taxCents: 0, totalCents: 0,
              syncedAt: new Date(),
            },
            include: { items: true, table: true }
          });
          broadcastToRestaurant(restaurantId, "order", deviceId);
          return reply.send({ success: true, data: order });
        }
        case "add_order_item": {
          const { deviceId, payload } = args;
          const { orderId, productId, quantity, notes } = payload;
          
          const product = await prisma.product.findUnique({ where: { id: productId } });
          if (!product) return reply.code(404).send({ error: "Product not found" });

          const existing = await prisma.orderItem.findFirst({
            where: { orderId, productId, deletedAt: null }
          });

          if (existing) {
            await prisma.orderItem.update({
              where: { id: existing.id },
              data: { quantity: existing.quantity + quantity, updatedAt: new Date(), syncedAt: new Date() }
            });
          } else {
            await prisma.orderItem.create({
              data: {
                id: createId(),
                restaurantId,
                orderId,
                productId,
                deviceId,
                quantity,
                unitPriceCents: product.priceCents,
                notes: notes ?? null,
                syncedAt: new Date()
              }
            });
          }
          
          const updated = await recalcTotals(orderId);
          return reply.send({ success: true, data: updated });
        }
        case "remove_order_item": {
          const { orderId, itemId } = args;
          await prisma.orderItem.updateMany({
            where: { id: itemId, orderId, restaurantId },
            data: { deletedAt: new Date(), syncedAt: new Date() }
          });
          const updated = await recalcTotals(orderId);
          return reply.send({ success: true, data: updated });
        }
        case "update_order_status": {
          const { payload: { orderId, status } } = args;
          await prisma.order.updateMany({
            where: { id: orderId, restaurantId },
            data: { status, updatedAt: new Date(), syncedAt: new Date(), ...(status === 'COMPLETED' ? { paidAt: new Date() } : {}) }
          });
          const updated = await recalcTotals(orderId);
          return reply.send({ success: true, data: updated });
        }
        case "toggle_order_gst": {
          const { orderId, applyGst } = args.payload;
          await prisma.order.updateMany({
            where: { id: orderId, restaurantId },
            data: { applyGst, updatedAt: new Date(), syncedAt: new Date() }
          });
          const updated = await recalcTotals(orderId);
          return reply.send({ success: true, data: updated });
        }
        default:
          return reply.code(400).send({ error: `Command ${command} not supported on rpc route` });
      }
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
