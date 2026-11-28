/*  Controlador de búsqueda de usuarios. Requiere sesión (authMiddleware). */

import { Request, Response } from "express";
import { AppError } from "../utils/appError";
import { lookupUserByEmail } from "./users.service";

export const lookup = async (req: Request, res: Response) => {
    const email = req.query.email;

    if (typeof email !== "string" || !email.trim()) {
        throw new AppError("Ingresá un email para buscar", 400);
    }

    if (!req.userId) {
        throw new AppError("Token inválido o vencido", 401);
    }

    const user = await lookupUserByEmail(req.userId, email);

    res.status(200).json(user);
};
