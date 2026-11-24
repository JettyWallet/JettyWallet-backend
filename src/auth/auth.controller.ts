/*  Controladores de autenticación.

    Reciben la petición HTTP, validan los datos de entrada y delegan en el
    servicio. Los errores se lanzan con AppError y los responde el errorHandler
    global, por eso no hay try/catch. */

import { Request, Response } from "express";
import { AppError } from "../utils/appError";
import { getUserById, loginUser, registerUser } from "./auth.service";

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

    res.status(201).json({
        message: "Usuario registrado correctamente",
        token,
        user,
    });
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

    res.status(200).json({ token, user });
};

export const getMe = async (req: Request, res: Response) => {
    if (!req.userId) {
        throw new AppError("Token inválido o vencido", 401);
    }

    const user = await getUserById(req.userId);

    res.status(200).json({ user });
};