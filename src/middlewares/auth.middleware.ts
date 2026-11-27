/*  Middleware de autenticación. Toma el JWT de la cookie de sesión, lo verifica
    y deja el id del usuario en req.userId para las rutas siguientes.
    Si el token falta, es inválido o venció, responde 401.

    Solo se acepta la cookie: el header "Authorization: Bearer" se ignora. */

import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { SESSION_COOKIE } from "../auth/session";
import { env } from "../config/env";
import { AppError } from "../utils/appError";

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

const readCookieToken = (req: Request): string | undefined => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    return typeof token === "string" && token ? token : undefined;
};

export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
    const token = readCookieToken(req);

    if (!token) {
        throw new AppError("Token no enviado", 401);
    }

    if (!env.jwtSecret) {
        throw new Error("JWT_SECRET no está configurado");
    }

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
