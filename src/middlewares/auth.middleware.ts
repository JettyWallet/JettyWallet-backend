/*  Middleware de autenticación. Lee el header "Authorization: Bearer <token>",
    verifica el JWT y deja el id del usuario en req.userId para las rutas siguientes.
    Si el token falta, es inválido o venció, responde 401. */

import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/appError";

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
        throw new AppError("Token no enviado", 401);
    }

    if (!env.jwtSecret) {
        throw new Error("JWT_SECRET no está configurado");
    }

    const token = header.slice("Bearer ".length).trim();

    let payload: { userId?: string };
    try {
        payload = jwt.verify(token, env.jwtSecret) as { userId?: string };
    } catch {
        throw new AppError("Token inválido o vencido", 401);
    }

    if (!payload.userId) {
        throw new AppError("Token inválido o vencido", 401);
    }

    req.userId = payload.userId;
    next();
};
