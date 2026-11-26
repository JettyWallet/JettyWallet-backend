/*  Controlador de depósitos. Valida el body y delega en el servicio. */

import { Request, Response } from "express";
import { DEPOSIT_RULES } from "../config/wallet";
import { AppError } from "../utils/appError";
import { createDeposit } from "./deposit.service";

// Número positivo con hasta 2 decimales, escrito en notación común.
// String(0.1 + 0.2) es "0.30000000000000004" y String(1e-7) es "1e-7":
// los dos se rechazan, que es lo correcto para un monto de dinero.
const MONEY_FORMAT = /^\d+(\.\d{1,2})?$/;

const CURRENCY_FORMAT = /^[A-Z]{3}$/;

export const postDeposit = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Token inválido o vencido", 401);
    }

    const { currency, amount } = req.body ?? {};

    const currencyCode = typeof currency === "string" ? currency.trim().toUpperCase() : "";
    if (!CURRENCY_FORMAT.test(currencyCode)) {
        throw new AppError("Indicá una moneda válida (ARS, COP, EUR o USD)", 400);
    }

    if (
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !MONEY_FORMAT.test(String(amount))
    ) {
        throw new AppError("El monto tiene que ser un número mayor a 0 con hasta 2 decimales", 400);
    }

    if (amount > DEPOSIT_RULES.maxAmount) {
        throw new AppError(
            `El monto máximo por depósito es ${DEPOSIT_RULES.maxAmount.toLocaleString("es-AR")}`,
            422
        );
    }

    res.status(201).json(await createDeposit(req.userId, currencyCode, amount));
};
