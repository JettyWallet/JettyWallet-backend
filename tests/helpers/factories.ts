/*  Crean datos de prueba directamente en la base, sin pasar por la API.
    Sirven para preparar el escenario de un test en una línea. */

import { randomUUID } from "node:crypto";
import { pool } from "./db";

interface CreatedUser {
    userId: string;
    walletId: string;
    email: string;
}

// Usuario con su billetera, sin saldos. El email es único en cada llamada.
export const createUserWithWallet = async (
    overrides: { name?: string; email?: string } = {}
): Promise<CreatedUser> => {
    const email = overrides.email ?? `user-${randomUUID()}@test.com`;

    const user = await pool.query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, 'hash-de-prueba')
         RETURNING id`,
        [overrides.name ?? "Usuario de prueba", email]
    );

    const wallet = await pool.query(
        "INSERT INTO wallets (user_id) VALUES ($1) RETURNING id",
        [user.rows[0].id]
    );

    return { userId: user.rows[0].id, walletId: wallet.rows[0].id, email };
};
