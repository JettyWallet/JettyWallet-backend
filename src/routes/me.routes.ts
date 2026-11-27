/*  Rutas del usuario de la sesión. Se montan en /api (ver routes/index.ts),
    y todas pasan por authMiddleware. */

import { Router } from "express";
import { getMe } from "../auth/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

/**
 * @swagger
 * /api/me:
 *   get:
 *     summary: Devuelve el usuario de la sesión
 *     tags: [Autenticación]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Usuario de la sesión
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Sin sesión, sesión inválida o vencida, o el usuario ya no existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/me", authMiddleware, getMe);

export default router;
