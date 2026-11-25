/*  Protección contra CSRF: rechaza los requests que modifican datos
    (POST, PUT, PATCH, DELETE) si vienen desde un sitio que no es el nuestro.

    Con la sesión en cookie, el navegador la manda sola en cada request. Un
    sitio malicioso podría intentar que el navegador del usuario haga un POST
    a la API en su nombre. SameSite=Lax ya lo frena en los navegadores
    modernos; este chequeo es una segunda barrera.

    Los navegadores mandan el header Origin en todos los POST. Se acepta si es:
    - uno de los orígenes de FRONTEND_URL (el front, en local o en Vercel), o
    - el propio dominio de la API (por ejemplo, Swagger en /api-docs).
    Sin Origin (curl, Postman, tests) no hay navegador que proteger: se deja pasar. */

import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { AppError } from "../utils/appError";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const isOwnOrigin = (origin: string, req: Request): boolean => {
    try {
        return new URL(origin).host === req.get("host");
    } catch {
        return false;
    }
};

export const originCheck = (req: Request, _res: Response, next: NextFunction) => {
    const origin = req.get("origin");

    if (
        SAFE_METHODS.has(req.method) ||
        !origin ||
        env.frontendUrls.includes(origin) ||
        isOwnOrigin(origin, req)
    ) {
        next();
        return;
    }

    throw new AppError("Origen no permitido", 403);
};
