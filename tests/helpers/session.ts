/*  Utilidades para la cookie de sesión en los tests.

    - Para un flujo completo (login, después rutas protegidas), lo más simple es
      request.agent(app): guarda la cookie y la reenvía sola, como un navegador.
    - Para casos puntuales (token vencido, firmado con otro secreto, etc.),
      sessionCookie(token) arma el header Cookie a mano. */

import type { Response } from "supertest";
import { SESSION_COOKIE } from "../../src/auth/session";

// Valor del header Cookie para mandar `token` como sesión.
export const sessionCookie = (token: string): string => `${SESSION_COOKIE}=${token}`;

// Header Set-Cookie de la cookie de sesión de una respuesta (o undefined).
export const sessionCookieHeader = (res: Response): string | undefined => {
    const raw = res.headers["set-cookie"] as unknown as string[] | string | undefined;
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
};

// JWT que vino en la cookie de sesión de una respuesta (o undefined).
export const sessionToken = (res: Response): string | undefined =>
    sessionCookieHeader(res)?.split(";")[0].slice(SESSION_COOKIE.length + 1) || undefined;
