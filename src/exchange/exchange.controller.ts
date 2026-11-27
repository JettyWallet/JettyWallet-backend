/*  Controlador de intercambios. Valida el body y delega en el servicio. */

import { Request, Response } from "express";
import { AppError } from "../utils/appError";
import { INVALID_AMOUNT_MESSAGE, isValidMoneyAmount, parseCurrencyCode } from "../utils/validation";
import { createExchange } from "./exchange.service";

export const postExchange = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Token inválido o vencido", 401);
    }

    const { fromCurrency, toCurrency, amount } = req.body ?? {};

    const from = parseCurrencyCode(fromCurrency);
    if (!from) {
        throw new AppError("Indicá una moneda de origen válida (ARS, COP, EUR o USD)", 400);
    }

    const to = parseCurrencyCode(toCurrency);
    if (!to) {
        throw new AppError("Indicá una moneda de destino válida (ARS, COP, EUR o USD)", 400);
    }

    if (from === to) {
        throw new AppError("Elegí dos monedas distintas", 400);
    }

    if (!isValidMoneyAmount(amount)) {
        throw new AppError(INVALID_AMOUNT_MESSAGE, 400);
    }

    res.status(201).json(await createExchange(req.userId, from, to, amount));
};
