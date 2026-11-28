/*  Controlador de depósitos. Valida el body y delega en el servicio.
    El máximo por depósito depende de la cotización: lo controla el servicio. */

import { Request, Response } from "express";
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

    res.status(201).json(await createDeposit(req.userId, currencyCode, amount));
};
