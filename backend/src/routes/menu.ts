// src/routes/menu.ts
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import { requireAuth, requireRole } from "../auth/auth.service.js";
import { createId } from "@paralleldrive/cuid2";

const CreateProductSchema = z.object({
  name:        z.string().min(1),
  categoryId:  z.string().optional(),
  description: z.string().optional(),
  priceCents:  z.number().int().nonnegative(),
  taxRatePct:  z.number().min(0).max(100).default(0),
  imageUrl:    z.string().url().optional(),
});

const CreateCategorySchema = z.object({
  name:      z.string().min(1),
  sortOrder: z.number().int().default(0),
});

export async function menuRoutes(app: FastifyInstance) {
  // GET /menu — all staff can read
  app.get("/", { preHandler: requireAuth }, async (req, reply) => {
    const { restaurantId } = req.jwtPayload!;
    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        where:   { restaurantId, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.product.findMany({
        where:   { restaurantId, deletedAt: null },
        orderBy: { name: "asc" },
      }),
    ]);
    return reply.send({ success: true, data: { categories, products } });
  });

  // GET /tables — restaurant seating, all staff can read
  // Lives alongside menu routes since this is the same kind of "restaurant
  // configuration" data (rarely changes, no write UI yet).
  app.get("/tables", { preHandler: requireAuth }, async (req, reply) => {
    const { restaurantId } = req.jwtPayload!;
    const tables = await prisma.restaurantTable.findMany({
      where:   { restaurantId, deletedAt: null },
      orderBy: { label: "asc" },
    });
    return reply.send({ success: true, data: tables });
  });

  // POST /menu/categories — ADMIN only
  app.post("/categories", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const body = CreateCategorySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { restaurantId } = req.jwtPayload!;
    const category = await prisma.category.create({
      data: { id: createId(), restaurantId, ...body.data },
    });
    return reply.code(201).send({ success: true, data: category });
  });

  // POST /menu/products — ADMIN only
  app.post("/products", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const body = CreateProductSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { restaurantId } = req.jwtPayload!;
    const { name, priceCents, taxRatePct, categoryId, description, imageUrl } = body.data;

    const product = await prisma.product.create({
      data: { 
        id: createId(), 
        restaurantId, 
        name,
        priceCents,
        taxRatePct,
        categoryId:  categoryId ?? null,  // <-- FIX: Strict null mapping
        description: description ?? null, // <-- FIX: Strict null mapping
        imageUrl:    imageUrl ?? null     // <-- FIX: Strict null mapping
      },
    });
    return reply.code(201).send({ success: true, data: product });
  });

  // PATCH /menu/products/:id — ADMIN only
  app.patch("/products/:id", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { restaurantId } = req.jwtPayload!;
    const body = CreateProductSchema.partial().safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    // FIX: Safely strip undefined and map to null for Prisma
    const updateData = Object.fromEntries(
      Object.entries(body.data).map(([k, v]) => [k, v ?? null])
    );

    const product = await prisma.product.updateMany({
      where: { id, restaurantId, deletedAt: null },
      data:  updateData,
    });
    if (product.count === 0) return reply.code(404).send({ error: "Not found" });
    return reply.send({ success: true });
  });

  // DELETE /menu/products/:id — soft delete, ADMIN only
  app.delete("/products/:id", { preHandler: requireRole("ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { restaurantId } = req.jwtPayload!;
    await prisma.product.updateMany({
      where: { id, restaurantId, deletedAt: null },
      data:  { deletedAt: new Date() },
    });
    return reply.send({ success: true });
  });
}
