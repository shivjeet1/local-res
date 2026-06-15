// src/auth/auth.service.ts
import { FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma/client.js";

export type JwtPayload = {
  sub:          string;   // userId
  restaurantId: string;
  role:         "ADMIN" | "STAFF" | "KITCHEN";
  deviceId?:    string;
};

const JWT_SECRET  = process.env.JWT_SECRET!;
const JWT_EXPIRES = "7d";

// ── Token ──────────────────────────────────────────────────────────────────

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// ── Login ──────────────────────────────────────────────────────────────────

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
    select: {
      id: true, restaurantId: true, name: true,
      email: true, role: true, passwordHash: true,
    },
  });

  if (!user) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Invalid credentials");

  const { passwordHash, ...safeUser } = user;
  const token = signToken({
    sub:          user.id,
    restaurantId: user.restaurantId,
    role:         user.role,
  });

  return { user: safeUser, token };
}

// ── Fastify preHandler guards ──────────────────────────────────────────────

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Missing token" });
  }
  try {
    req.jwtPayload = verifyToken(header.slice(7));
  } catch {
    return reply.code(401).send({ error: "Invalid token" });
  }
}

export function requireRole(...roles: JwtPayload["role"][]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;
    if (!roles.includes(req.jwtPayload!.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  };
}

// Augment Fastify types
declare module "fastify" {
  interface FastifyRequest {
    jwtPayload?: JwtPayload;
  }
}
