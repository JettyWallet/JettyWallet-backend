/*  Controladores de autenticación.

    Reciben la petición HTTP, validan los datos de entrada y delegan en el
    servicio. Los errores se lanzan con AppError y los responde el errorHandler
    global, por eso no hay try/catch. */

import { Request, Response } from "express";
import { AppError } from "../utils/appError";
import { registerUser } from "./auth.service";

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

    const user = await registerUser(
        name.trim(),
        email.trim().toLowerCase(),
        password
    );

    res.status(201).json({
        message: "Usuario registrado correctamente",
        user,
    });
};

// Pendiente (Fase 1): conectar con loginUser y devolver { token, user }.
export const login = (req: Request, res: Response) => {
    const { email } = req.body ?? {};

    res.status(200).json({
        message: "Datos de login recibidos",
        email,
    });
};
