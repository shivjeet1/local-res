// src/prisma/client.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // Prevent multiple instances in dev hot-reload
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query","warn","error"] : ["error"],
});

if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;
