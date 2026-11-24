/*  Rutas de la billetera. Se montan en /api/wallet (ver routes/index.ts)
    y todas requieren sesión. */

import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getSummary } from "./wallet.controller";

const router = Router();

/**
 * @swagger
 * /api/wallet/summary:
 *   get:
 *     summary: Saldos de la billetera y su valor en USD
 *     description: >
 *       Devuelve el saldo de cada moneda y cuántos USD vale 1 unidad de cada una,
 *       para que el front calcule el total. Si no hay cotización guardada para una
 *       moneda, se usa un valor de referencia aproximado. change24h es 0 por ahora.
 *     tags: [Billetera]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen de la billetera
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletSummary'
 *       401:
 *         description: Token ausente, inválido o vencido, o el usuario ya no existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/summary", authMiddleware, getSummary);

export default router;
