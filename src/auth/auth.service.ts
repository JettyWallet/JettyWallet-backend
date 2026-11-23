/*  Servicio de autenticación. Gestiona el registro de usuarios, se realiza la creación automatica
    de billetera en PostgreSQL y se protegen las contraseñas  */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/database";
import { env } from "../config/env";
import { AppError } from "../utils/appError";

// Código de PostgreSQL para violación de una restricción UNIQUE.
const PG_UNIQUE_VIOLATION = "23505";

const isUniqueViolation = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === PG_UNIQUE_VIOLATION;

export const registerUser = async (
    name: string,
    email: string,
    password: string
) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Comprobar si el email ya existe.
        const existingUser = await client.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            throw new AppError("El email ya está registrado", 409);
        }

        // Proteger la contraseña.
        const passwordHash = await bcrypt.hash(password, 12);

        // Crear el usuario.
        const result = await client.query(
            `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
            [name, email, passwordHash]
        );

        const user = result.rows[0];

        // Crear la billetera del usuario.
        await client.query(
            "INSERT INTO wallets (user_id) VALUES ($1)",
            [user.id]
        );

        await client.query("COMMIT");

        return user;

    } catch (error) {
        await client.query("ROLLBACK");

        // Dos registros simultáneos con el mismo email pueden pasar la
        // comprobación de arriba; la restricción UNIQUE frena al segundo.
        if (isUniqueViolation(error)) {
            throw new AppError("El email ya está registrado", 409);
        }

        throw error;

    } finally {
        client.release();
    }
};

export const loginUser = async (
    email: string,
    password: string
) => {
    // Buscar al usuario por su email.
    const result = await pool.query(
        `SELECT id, name, email, password_hash
     FROM users
     WHERE email = $1`,
        [email]
    );

    const user = result.rows[0];

    // Comprobar si el usuario existe.
    if (!user) {
        throw new AppError("Credenciales incorrectas", 401);
    }

    // Comparar la contraseña con el hash almacenado.
    const validPassword = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!validPassword) {
        throw new AppError("Credenciales incorrectas", 401);
    }

    // Obtener la clave secreta del servidor.
    const jwtSecret = env.jwtSecret;

    if (!jwtSecret) {
        throw new Error("JWT_SECRET no está configurado");
    }

    // Generar el token de autenticación.
    const token = jwt.sign(
        { userId: user.id },
        jwtSecret,
        { expiresIn: "1h" }
    );

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email
        }
    };
};