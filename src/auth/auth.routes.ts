/*  Rutas de autenticación. Se montan en /api/auth (ver routes/index.ts). */

import { Router } from "express";
import { register, login } from "./auth.controller";

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registra un usuario y crea su billetera
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Ana Pérez
 *               email:
 *                 type: string
 *                 example: ana@mail.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "12345678"
 *     responses:
 *       201:
 *         description: Usuario registrado
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: El email ya está registrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/register", register);

// Pendiente (Fase 1): documentar cuando devuelva { token, user }.
router.post("/login", login);

export default router;
