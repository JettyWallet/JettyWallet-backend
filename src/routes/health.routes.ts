/*  Estado de la API. Sirve como ejemplo de cómo documentar un endpoint
    con Swagger: la anotación de abajo se publica en /api-docs. */

import { Router } from "express";

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Estado de la API
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: La API está funcionando
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: JettyWallet API funcionando correctamente
 */
router.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
        message: "JettyWallet API funcionando correctamente",
    });
});

export default router;
