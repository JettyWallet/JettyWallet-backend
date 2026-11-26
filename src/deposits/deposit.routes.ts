/*  Rutas de depósitos. Se montan en /api/deposits (ver routes/index.ts)
    y requieren sesión. */

import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { postDeposit } from "./deposit.controller";

const router = Router();

/**
 * @swagger
 * /api/deposits:
 *   post:
 *     summary: Deposita dinero (simulado) en una moneda de la billetera
 *     tags: [Operaciones]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currency, amount]
 *             properties:
 *               currency:
 *                 type: string
 *                 example: ARS
 *               amount:
 *                 type: number
 *                 description: Mayor a 0, hasta 2 decimales, máximo 1.000.000 por depósito
 *                 example: 50000
 *     responses:
 *       201:
 *         description: Depósito realizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepositResponse'
 *       400:
 *         description: Moneda o monto inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Sin sesión, o sesión inválida o vencida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       422:
 *         description: Supera el máximo por depósito
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", authMiddleware, postDeposit);

export default router;
