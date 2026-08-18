// src/prisma/client.ts
import { PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";

declare global {
  // Prevent multiple instances in dev hot-reload
  var __prisma: PrismaClient | undefined;
}

export const tenantContext = new AsyncLocalStorage<{ restaurantId?: string }>();

export const unscopedPrisma = globalThis.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query","warn","error"] : ["error"],
});

if (process.env.NODE_ENV !== "production") globalThis.__prisma = unscopedPrisma;

export const prisma = unscopedPrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const isWrite = ["create", "update", "updateMany", "delete", "deleteMany", "upsert"].includes(operation);
        
        if (!args) {
          args = {} as any;
        }

        const hasWhere = operation !== "create" && operation !== "createMany";

        if (hasWhere && !(args as any).where) {
          (args as any).where = {};
        }

        // 1. Tenant Scoping
        const store = tenantContext.getStore();
        if (store?.restaurantId && model !== "User" && hasWhere) {
          (args as any).where.restaurantId = store.restaurantId;
        }

        // 2. Soft Deletes (Filter out deleted records for reads)
        if (!isWrite && hasWhere) {
          if ((args as any).where.deletedAt === undefined) {
            (args as any).where.deletedAt = null;
          }
        }

        // 3. Soft Delete writes (convert delete to update)
        if (operation === "delete") {
          return query({
            ...args,
            operation: "update",
            data: { deletedAt: new Date() },
          } as any);
        }
        if (operation === "deleteMany") {
          return query({
            ...args,
            operation: "updateMany",
            data: { deletedAt: new Date() },
          } as any);
        }

        return query(args);
      }
    }
  }
});

