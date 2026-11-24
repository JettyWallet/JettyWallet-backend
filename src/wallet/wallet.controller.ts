/*  Controladores de la billetera. Todas las rutas pasan por authMiddleware,
    que deja el id del usuario de la sesión en req.userId. */

import { Request, Response } from "express";
import { AppError } from "../utils/appError";
import { getWalletSummary } from "./wallet.service";

export const getSummary = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Token inválido o vencido", 401);
    }

    res.status(200).json(await getWalletSummary(req.userId));
};
