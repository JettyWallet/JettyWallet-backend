/*  Rutas del historial de movimientos. Se montan en /api/transactions
    (ver routes/index.ts) y requieren sesión. */

import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getTransactions } from "./transaction.controller";

const router = Router();

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Movimientos de la billetera, más recientes primero
 *     description: >
 *       Paginación por cursor: para la página siguiente, mandar en before el id
 *       del último movimiento recibido. Si llegan menos movimientos que limit,
 *       no hay más.
 *     tags: [Billetera]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: before
 *         description: id del último movimiento que ya tiene el front
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [deposit, exchange, transfer_in, transfer_out]
 *       - in: query
 *         name: currency
 *         description: Movimientos donde entra o sale esa moneda
 *         schema:
 *           type: string
 *           example: USD
 *     responses:
 *       200:
 *         description: Lista de movimientos (puede estar vacía)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Parámetros inválidos, o before no es un movimiento de la billetera
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
 */
router.get("/", authMiddleware, getTransactions);

export default router;
