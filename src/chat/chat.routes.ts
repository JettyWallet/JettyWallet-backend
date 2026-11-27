import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "../middlewares/auth.middleware";
import { chat } from "./chat.controller";

const router = Router();

// Límite por usuario: 10 mensajes por minuto, así no se gasta la cuota de Gemini.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.userId ?? "sin-sesion",
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Demasiados mensajes, probá en un minuto" },
});

router.post("/", authMiddleware, chatLimiter, chat);

export default router;