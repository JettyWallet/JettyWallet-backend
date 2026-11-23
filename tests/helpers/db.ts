/*  Utilidades para los tests que usan la base de datos.

    Uso típico:

        describe.skipIf(!hasTestDatabase)("mi módulo", () => {
            beforeEach(resetDatabase);
            afterAll(closeDatabase);
            ...
        });
*/

import pool from "../../src/config/database";

export const hasTestDatabase = Boolean(process.env.DATABASE_URL_TEST);

// Borra los datos de todas las tablas, excepto el catálogo de monedas
// (que cargan las migraciones y los tests necesitan).
export const resetDatabase = async (): Promise<void> => {
    await pool.query(`
        TRUNCATE
            transactions,
            savings_goals,
            balances,
            wallets,
            users,
            exchange_rates
        CASCADE
    `);
};

export const closeDatabase = async (): Promise<void> => {
    await pool.end();
};

export { pool };
