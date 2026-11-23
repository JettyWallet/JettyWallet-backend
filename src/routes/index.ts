/*  Router principal. Se monta en /api (ver app.ts), así que cada ruta
    registrada acá queda bajo ese prefijo: "/health" -> "/api/health".

    Para sumar un módulo nuevo: crear su archivo *.routes.ts y registrarlo acá. */

import { Router } from "express";
import authRoutes from "../auth/auth.routes";
import healthRoutes from "./health.routes";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);

export default router;
