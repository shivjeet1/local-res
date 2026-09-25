// src/routes/admin.ts — ADMIN role only
import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma/client.js";
import { requireRole } from "../auth/auth.service.js";
import { createId } from "@paralleldrive/cuid2";

const CreateUserSchema = z.object({
  name:     z.string().min(1),
  email:    z.string().email(),
  password: z.string().min(8),
  role:     z.enum(["ADMIN","STAFF","KITCHEN"]).default("STAFF"),
});

export async function adminRoutes(app: FastifyInstance) {

  // GET /admin/users
  app.get("/users", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const { restaurantId } = req.jwtPayload!;
    const users = await prisma.user.findMany({
      where:  { restaurantId, deletedAt: null },
      select: { id:true, name:true, email:true, role:true, createdAt:true, updatedAt:true },
      orderBy: { name: "asc" },
    });
    return reply.send({ success: true, data: users });
  });

  // POST /admin/users
  app.post("/users", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const body = CreateUserSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { restaurantId } = req.jwtPayload!;
    const passwordHash = await bcrypt.hash(body.data.password, 12);

    const user = await prisma.user.create({
      data: {
        id: createId(),
        restaurantId,
        name:  body.data.name,
        email: body.data.email.toLowerCase(),
        passwordHash,
        role:  body.data.role,
      },
      select: { id:true, name:true, email:true, role:true, createdAt:true },
    });

    return reply.code(201).send({ success: true, data: user });
  });

  // DELETE /admin/users/:id — soft delete, cannot delete self
  app.delete("/users/:id", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { restaurantId, sub } = req.jwtPayload!;

    if (id === sub) return reply.code(400).send({ error: "Cannot delete self" });

    await prisma.user.updateMany({
      where: { id, restaurantId, deletedAt: null },
      data:  { deletedAt: new Date() },
    });

    return reply.send({ success: true });
  });

  // GET /admin/devices — registered devices
  app.get("/devices", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const { restaurantId } = req.jwtPayload!;
    const devices = await prisma.device.findMany({
      where:   { restaurantId, deletedAt: null },
      orderBy: { lastSeenAt: "desc" },
    });
    return reply.send({ success: true, data: devices });
  });

  
  // GET /admin/reports/export — CSV export of daily sales
  app.get("/reports/export", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const { restaurantId } = req.jwtPayload!;
    const query = req.query as Record<string, string>;
    const date  = query.date ? new Date(query.date) : new Date();

    const start = new Date(date); start.setHours(0,0,0,0);
    const end   = new Date(date); end.setHours(23,59,59,999);

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        status: "COMPLETED",
        paidAt: { gte: start, lte: end },
        deletedAt: null,
      },
      include: {
        table: true,
        items: {
          where: { deletedAt: null },
          include: { product: true }
        }
      },
      orderBy: { paidAt: "asc" }
    });

    // Generate CSV
    const headers = ["Order ID", "Time", "Table", "Status", "Subtotal", "Tax", "Total", "Items"];
    const rows = orders.map(o => {
      const time = o.paidAt ? o.paidAt.toLocaleTimeString('en-US', { hour12: false }) : '';
      const table = o.table ? o.table.label : 'N/A';
      const itemsStr = o.items.map(i => `${i.quantity}x ${i.product.name}`).join("; ");
      
      return [
        o.id,
        time,
        table,
        o.status,
        (o.subtotalCents / 100).toFixed(2),
        (o.taxCents / 100).toFixed(2),
        (o.totalCents / 100).toFixed(2),
        `"${itemsStr}"`
      ].join(",");
    });

    const csvData = [headers.join(","), ...rows].join("\n");
    const dateStr = start.toISOString().split("T")[0];

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="sales_report_${dateStr}.csv"`);
    return reply.send(csvData);
  });

  // GET /admin/reports/daily — simple daily sales totals
  app.get("/reports/daily", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const { restaurantId } = req.jwtPayload!;
    const query = req.query as Record<string, string>;
    const date  = query.date ? new Date(query.date) : new Date();

    const start = new Date(date); start.setHours(0,0,0,0);
    const end   = new Date(date); end.setHours(23,59,59,999);

    const result = await prisma.order.aggregate({
      where: {
        restaurantId,
        status:    "COMPLETED",
        paidAt:    { gte: start, lte: end },
        deletedAt: null,
      },
      _sum:   { totalCents: true, taxCents: true, subtotalCents: true },
      _count: { id: true },
    });

    return reply.send({
      success: true,
      data: {
        date:          start.toISOString().split("T")[0],
        orderCount:    result._count.id,
        subtotalCents: result._sum.subtotalCents ?? 0,
        taxCents:      result._sum.taxCents ?? 0,
        totalCents:    result._sum.totalCents ?? 0,
      },
    });
  });

  // GET /admin/reports/dashboard — Comprehensive dashboard data
  app.get("/reports/dashboard", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const { restaurantId } = req.jwtPayload!;
    
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999);
    
    // 7 days ago
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0,0,0,0);

    // 1. Today's totals
    const todayStats = await prisma.order.aggregate({
      where: {
        restaurantId,
        status: "COMPLETED",
        paidAt: { gte: todayStart, lte: todayEnd },
        deletedAt: null,
      },
      _sum: { totalCents: true },
      _count: { id: true },
    });

    const revenue = todayStats._sum.totalCents ?? 0;
    const orderCount = todayStats._count.id;
    const averageOrderValue = orderCount > 0 ? Math.floor(revenue / orderCount) : 0;

    // 2. Active orders count
    const activeOrders = await prisma.order.count({
      where: {
        restaurantId,
        status: { in: ["OPEN", "SENT_TO_KITCHEN", "READY"] },
        deletedAt: null,
      }
    });

    // 3. Trend chart (Last 7 days)
    const weekOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        status: "COMPLETED",
        paidAt: { gte: weekStart, lte: todayEnd },
        deletedAt: null,
      },
      select: { paidAt: true, totalCents: true }
    });

    const trendMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      trendMap.set(d.toISOString().split("T")[0]!, 0);
    }
    
    for (const order of weekOrders) {
      if (order.paidAt) {
        const dStr = order.paidAt.toISOString().split("T")[0]!;
        if (trendMap.has(dStr)) {
          trendMap.set(dStr, trendMap.get(dStr)! + order.totalCents);
        }
      }
    }

    const trend = Array.from(trendMap.entries()).map(([date, total]) => ({ date, total }));

    // 4. Top 5 items today
    const todayOrderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId,
          status: "COMPLETED",
          paidAt: { gte: todayStart, lte: todayEnd },
          deletedAt: null,
        },
        deletedAt: null,
      },
      include: { product: true }
    });

    const itemCounts = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const item of todayOrderItems) {
      if (!itemCounts.has(item.productId)) {
        itemCounts.set(item.productId, { name: item.product.name, qty: 0, revenue: 0 });
      }
      const entry = itemCounts.get(item.productId)!;
      entry.qty += item.quantity;
      entry.revenue += item.quantity * item.unitPriceCents;
    }

    const topItems = Array.from(itemCounts.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return reply.send({
      success: true,
      data: {
        today: { revenue, orderCount, averageOrderValue, activeOrders },
        trend,
        topItems
      }
    });
  });
}
