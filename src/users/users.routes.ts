/*  Rutas de usuarios. Se montan en /api/users (ver routes/index.ts).
    La búsqueda tiene un límite por usuario: 20 consultas por minuto. */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "../middlewares/auth.middleware";
import { lookup } from "./users.controller";

// Se cuenta por usuario y no por IP: detrás de Vercel y Railway todos los
// pedidos llegan con la IP del proxy. authMiddleware corre antes, así que
// req.userId ya está cargado cuando se evalúa el límite.
const lookupLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    keyGenerator: (req) => req.userId ?? "sin-sesion",
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Demasiadas búsquedas, probá en un minuto" },
});

const router = Router();

/**
 * @swagger
 * /api/users/lookup:
 *   get:
 *     summary: Busca un usuario por email para una transferencia
 *     tags: [Usuarios]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           example: ana@mail.com
 *     responses:
 *       200:
 *         description: Nombre y email del usuario
 *       400:
 *         description: Falta el email o es el propio email de la sesión
 *       401:
 *         description: Sesión ausente o inválida
 *       404:
 *         description: No existe un usuario con ese email
 *       429:
 *         description: Demasiadas búsquedas en un minuto
 */
router.get("/lookup", authMiddleware, lookupLimiter, lookup);

export default router;
