/*  Cookie de sesión.

    El JWT viaja en una cookie httpOnly que setea y borra el backend:
    - httpOnly: el JavaScript de la página no la puede leer, así que un script
      inyectado (XSS) no puede robar la sesión.
    - sameSite "lax": el navegador no la manda en requests POST que vienen de
      otros sitios (protección contra CSRF, junto con originCheck).
    - secure: solo viaja por https. En desarrollo (http://localhost) se desactiva.
    - Sin "domain": queda asociada al dominio que la recibió. En producción el
      front llama a /api a través del rewrite de Vercel, así que la cookie es
      del dominio de Vercel y el navegador la trata como propia. */

import { CookieOptions, Response } from "express";
import { env } from "../config/env";

export const SESSION_COOKIE = "jetty_session";

// Lo que dura la sesión. El JWT y la cookie vencen al mismo tiempo.
export const SESSION_TTL_SECONDS = 60 * 60;

const cookieOptions = (): CookieOptions => ({
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    path: "/",
});

export const setSessionCookie = (res: Response, token: string): void => {
    res.cookie(SESSION_COOKIE, token, {
        ...cookieOptions(),
        maxAge: SESSION_TTL_SECONDS * 1000,
    });
};

// Para que el navegador la borre, las opciones tienen que coincidir con las de setSessionCookie.
export const clearSessionCookie = (res: Response): void => {
    res.clearCookie(SESSION_COOKIE, cookieOptions());
};
