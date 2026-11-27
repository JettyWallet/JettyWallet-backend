/*  Controlador del historial. Valida los parámetros de la URL y delega en el servicio. */

import { Request, Response } from "express";
import { AppError } from "../utils/appError";
import { parseCurrencyCode } from "../utils/validation";
import { listTransactions } from "./transaction.service";

export const TRANSACTIONS_LIMIT = { default: 20, max: 100 } as const;

// Tipos que se pueden filtrar (los que hoy ve el usuario).
const FILTERABLE_TYPES = ["deposit", "exchange", "transfer_in", "transfer_out"];

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un parámetro de la URL puede llegar repetido (?limit=1&limit=2) como array:
// solo se acepta texto.
const queryText = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

export const getTransactions = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Token inválido o vencido", 401);
    }

    const { limit, before, type, currency } = req.query;

    let parsedLimit: number = TRANSACTIONS_LIMIT.default;
    if (limit !== undefined) {
        const text = queryText(limit) ?? "";
        parsedLimit = /^\d+$/.test(text) ? Number(text) : NaN;
        if (!(parsedLimit >= 1 && parsedLimit <= TRANSACTIONS_LIMIT.max)) {
            throw new AppError(
                `limit tiene que ser un número entero entre 1 y ${TRANSACTIONS_LIMIT.max}`,
                400
            );
        }
    }

    let parsedBefore: string | undefined;
    if (before !== undefined) {
        parsedBefore = queryText(before);
        if (!parsedBefore || !UUID_FORMAT.test(parsedBefore)) {
            throw new AppError("before tiene que ser el id de un movimiento", 400);
        }
    }

    let parsedType: string | undefined;
    if (type !== undefined) {
        parsedType = queryText(type);
        if (!parsedType || !FILTERABLE_TYPES.includes(parsedType)) {
            throw new AppError(`type tiene que ser uno de: ${FILTERABLE_TYPES.join(", ")}`, 400);
        }
    }

    let parsedCurrency: string | undefined;
    if (currency !== undefined) {
        parsedCurrency = parseCurrencyCode(queryText(currency)) ?? undefined;
        if (!parsedCurrency) {
            throw new AppError("Indicá una moneda válida (ARS, COP, EUR o USD)", 400);
        }
    }

    res.json(
        await listTransactions(req.userId, {
            limit: parsedLimit,
            before: parsedBefore,
            type: parsedType,
            currency: parsedCurrency,
        })
    );
};
