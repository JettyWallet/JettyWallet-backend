/*  Rutas de usuarios. Se montan en /api (ver routes/index.ts) y todas
    pasan por authMiddleware. */

import { Router } from "express";
import { lookup } from "../users/users.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

/**
 * @swagger
 * /api/users/lookup:
 *   get:
 *     summary: Busca un usuario por email para una transferencia
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
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
 *         description: Token ausente, inválido o vencido
 *       404:
 *         description: No existe un usuario con ese email
 */
router.get("/users/lookup", authMiddleware, lookup);

export default router;
