// src/routes/auth.ts
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { loginUser } from "../auth/auth.service.js";

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/login
  app.post("/login", async (req, reply) => {
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() });
    }
    const result = await loginUser(body.data.email, body.data.password);
    return reply.send({ success: true, data: result });
  });

  // POST /auth/refresh — exchange valid token for a fresh one
  app.post("/refresh", async (req, reply) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing token" });
    }
    const { verifyToken, signToken } = await import("../auth/auth.service.js");
    try {
      const payload = verifyToken(header.slice(7));
      const token   = signToken(payload);
      return reply.send({ success: true, data: { token } });
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }
  });
}
