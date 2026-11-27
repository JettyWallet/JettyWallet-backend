/*  Controlador de depósitos. Valida el body y delega en el servicio. */

import { Request, Response } from "express";
import { DEPOSIT_RULES } from "../config/wallet";
import { AppError } from "../utils/appError";
import { INVALID_AMOUNT_MESSAGE, isValidMoneyAmount, parseCurrencyCode } from "../utils/validation";
import { createDeposit } from "./deposit.service";

export const postDeposit = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Token inválido o vencido", 401);
    }

    const { currency, amount } = req.body ?? {};

    const currencyCode = parseCurrencyCode(currency);
    if (!currencyCode) {
        throw new AppError("Indicá una moneda válida (ARS, COP, EUR o USD)", 400);
    }

    if (!isValidMoneyAmount(amount)) {
        throw new AppError(INVALID_AMOUNT_MESSAGE, 400);
    }

    if (amount > DEPOSIT_RULES.maxAmount) {
        throw new AppError(
            `El monto máximo por depósito es ${DEPOSIT_RULES.maxAmount.toLocaleString("es-AR")}`,
            422
        );
    }

    res.status(201).json(await createDeposit(req.userId, currencyCode, amount));
};
