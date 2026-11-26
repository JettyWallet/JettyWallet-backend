/*  Controladores de monedas y cotizaciones. */

import { Request, Response } from "express";
import { AppError } from "../utils/appError";
import { getCurrentRates } from "./currency.service";

export const getRates = async (_req: Request, res: Response) => {
    const { usdRates, updatedAt, stale, missing } = await getCurrentRates();

    // Sin cotización para alguna moneda no se puede convertir: mejor avisar
    // que devolver una lista incompleta.
    if (missing.length > 0) {
        throw new AppError("Las cotizaciones no están disponibles en este momento", 503);
    }

    res.status(200).json({ base: "USD", usdRates, updatedAt, stale });
};
