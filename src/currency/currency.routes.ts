/*  Rutas de cotizaciones. Se montan en /api/rates (ver routes/index.ts).
    Son públicas: las cotizaciones no son datos del usuario. */

import { Router } from "express";
import { getRates } from "./currency.controller";

const router = Router();

/**
 * @swagger
 * /api/rates:
 *   get:
 *     summary: Cotizaciones vigentes
 *     description: >
 *       Cuántos USD vale 1 unidad de cada moneda activa. Para convertir un monto
 *       de X a Y: monto × usdRates[X] / usdRates[Y]. Se renuevan cada 1 hora;
 *       si las APIs externas fallan, se devuelve la última guardada con stale = true.
 *     tags: [Cotizaciones]
 *     responses:
 *       200:
 *         description: Cotizaciones vigentes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rates'
 *       503:
 *         description: No hay cotización para alguna moneda (nunca se pudo obtener)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", getRates);

export default router;
