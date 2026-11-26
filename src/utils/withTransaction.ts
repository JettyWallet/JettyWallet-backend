/*  Ejecuta una función dentro de una transacción de PostgreSQL.

    Hace BEGIN, ejecuta `work` con un cliente dedicado y hace COMMIT. Si algo
    lanza un error, hace ROLLBACK (no queda nada a medias) y relanza el error.
    Siempre devuelve el cliente al pool.

    Uso:
        const result = await withTransaction(async (client) => {
            await client.query("UPDATE ...");
            await client.query("INSERT ...");
            return algo;
        });

    Todas las consultas de la operación tienen que usar `client`, no `pool`:
    las que vayan por `pool` quedan fuera de la transacción. */

import { PoolClient } from "pg";
import pool from "../config/database";

export const withTransaction = async <T>(work: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const result = await work(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
