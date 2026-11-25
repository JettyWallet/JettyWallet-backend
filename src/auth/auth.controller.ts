/*  Controladores de autenticación.

    Reciben la petición HTTP, validan los datos de entrada y delegan en el
    servicio. Los errores se lanzan con AppError y los responde el errorHandler
    global, por eso no hay try/catch. */

import { Request, Response } from "express";
import { AppError } from "../utils/appError";
import { getUserById, loginUser, registerUser } from "./auth.service";
import { clearSessionCookie, setSessionCookie } from "./session";

/*  TRANSICIÓN a cookie: login y register setean la cookie de sesión y, por
    ahora, siguen devolviendo también el token en el body, para que el front
    que todavía usa Bearer no se rompa. Cuando el front pase a la cookie
    (su PR #9), se saca `token` de la respuesta y queda solo { user }. */

export const register = async (req: Request, res: Response) => {
    const { name, email, password } = req.body ?? {};

    if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        !name.trim() ||
        !email.trim() ||
        password.length < 8
    ) {
        throw new AppError(
            "Ingresá nombre, email y una contraseña de al menos 8 caracteres",
            400
        );
    }

    const { token, user } = await registerUser(
        name.trim(),
        email.trim().toLowerCase(),
        password
    );

    setSessionCookie(res, token);
    res.status(201).json({ token, user });
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        throw new AppError("Ingresá email y contraseña", 400);
    }

    const { token, user } = await loginUser(email.trim().toLowerCase(), password);

    setSessionCookie(res, token);
    res.status(200).json({ token, user });
};

// Cierra la sesión borrando la cookie. No exige sesión: si no hay, igual
// responde 204, así el front siempre puede llamarlo al salir.
export const logout = (_req: Request, res: Response) => {
    clearSessionCookie(res);
    res.status(204).end();
};

export const getMe = async (req: Request, res: Response) => {
    const user = req.userId ? await getUserById(req.userId) : null;

    // Un token válido pero de un usuario que ya no existe (por ejemplo, tras
    // resetear la base) cuenta como sesión inválida: el front tiene que volver al login.
    if (!user) {
        throw new AppError("Token inválido o vencido", 401);
    }

    res.status(200).json(user);
};