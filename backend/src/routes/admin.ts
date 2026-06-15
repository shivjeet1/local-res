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
}
