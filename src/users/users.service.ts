/*  Búsqueda de usuarios por email, para transferencias.
    Devuelve solo el nombre y el email: nunca el id ni otros datos. */

import pool from "../config/database";
import { AppError } from "../utils/appError";

export interface PublicUser {
    name: string;
    email: string;
}

export const lookupUserByEmail = async (
    requesterId: string,
    email: string
): Promise<PublicUser> => {
    const normalized = email.trim().toLowerCase();

    const result = await pool.query<{ id: string; name: string; email: string }>(
        "SELECT id, name, email FROM users WHERE email = $1",
        [normalized]
    );

    const user = result.rows[0];

    if (!user) {
        throw new AppError("No existe un usuario con ese email", 404);
    }

    if (user.id === requesterId) {
        throw new AppError("No podés transferirte a vos mismo", 400);
    }

    return { name: user.name, email: user.email };
};
