/*  Rutas de intercambios. Se montan en /api/exchange (ver routes/index.ts)
    y requieren sesión. */

import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { postExchange } from "./exchange.controller";

const router = Router();

/**
 * @swagger
 * /api/exchange:
 *   post:
 *     summary: Intercambia saldo de una moneda a otra con la cotización actual
 *     description: >
 *       Lo que se recibe es amount x cotización, truncado a 2 decimales
 *       (nunca se redondea hacia arriba). Sin comisión y sin máximo por operación.
 *     tags: [Operaciones]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fromCurrency, toCurrency, amount]
 *             properties:
 *               fromCurrency:
 *                 type: string
 *                 example: USD
 *               toCurrency:
 *                 type: string
 *                 example: COP
 *               amount:
 *                 type: number
 *                 description: Monto en fromCurrency. Mayor a 0, hasta 2 decimales
 *                 example: 100
 *     responses:
 *       201:
 *         description: Intercambio realizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExchangeResponse'
 *       400:
 *         description: Monedas o monto inválidos, o monedas iguales
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
 *         description: Saldo insuficiente, o el monto convertido da 0
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       503:
 *         description: No hay cotización disponible para ese par de monedas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", authMiddleware, postExchange);

export default router;
