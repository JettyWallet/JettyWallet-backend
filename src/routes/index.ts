/*  Router principal. Se monta en /api (ver app.ts), así que cada ruta
    registrada acá queda bajo ese prefijo: "/health" -> "/api/health".

    Para sumar un módulo nuevo: crear su archivo *.routes.ts y registrarlo acá. */

import { Router } from "express";
import authRoutes from "../auth/auth.routes";
import currencyRoutes from "../currency/currency.routes";
import walletRoutes from "../wallet/wallet.routes";
import depositRoutes from "../deposits/deposit.routes";
import exchangeRoutes from "../exchange/exchange.routes";
import transactionRoutes from "../transactions/transaction.routes";
import healthRoutes from "./health.routes";
import meRoutes from "./me.routes";
import usersRoutes from "../users/users.routes";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use(meRoutes);
router.use("/deposits", depositRoutes);
router.use("/exchange", exchangeRoutes);
router.use("/transactions", transactionRoutes);
router.use("/wallet", walletRoutes);
router.use("/rates", currencyRoutes);
router.use("/users", usersRoutes);

export default router;