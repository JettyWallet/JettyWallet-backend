/*  Pool de conexiones a PostgreSQL.

    Crear el pool no abre ninguna conexión: se conecta recién en la primera
    consulta. La verificación de conexión se hace explícitamente al arrancar
    el servidor (checkDatabaseConnection), no al importar este archivo. */

import { Pool } from "pg";
import { env } from "./env";

const pool = new Pool({
    connectionString: env.databaseUrl,
});

export const checkDatabaseConnection = async (): Promise<void> => {
    await pool.query("SELECT 1");
};

export default pool;
