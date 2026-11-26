/*  Servicio de la billetera: saldos y operaciones sobre ellos. */

import { PoolClient } from "pg";
import pool from "../config/database";
import { WELCOME_DEPOSIT } from "../config/wallet";
import { getUsdRates } from "../currency/usd-rates";
import { AppError } from "../utils/appError";

export interface WalletSummary {
    balances: { currency: string; amount: number }[];
    usdRates: Record<string, number>;
    change24h: number;
}

/*  Deja lista la billetera de un usuario recién registrado:
    - un saldo por cada moneda activa (todas en 0, salvo la del depósito de bienvenida);
    - el depósito de bienvenida en el historial de movimientos.

    Recibe el `client` de una transacción abierta (BEGIN) y no hace COMMIT:
    se llama desde registerUser, para que el usuario, la billetera y sus saldos
    se creen todos juntos o no se cree ninguno.

    Uso:
        const wallet = await client.query(
            "INSERT INTO wallets (user_id) VALUES ($1) RETURNING id",
            [user.id]
        );
        await createInitialBalances(client, wallet.rows[0].id);

    Se llama una sola vez por billetera: si los saldos ya existen, la clave
    primaria de balances lo impide y lanza un error. */
export const createInitialBalances = async (
    client: PoolClient,
    walletId: string
): Promise<void> => {
    await client.query(
        `INSERT INTO balances (wallet_id, currency_code, amount)
         SELECT $1, code, CASE WHEN code = $2 THEN $3::numeric ELSE 0 END
         FROM currencies
         WHERE is_active`,
        [walletId, WELCOME_DEPOSIT.currency, WELCOME_DEPOSIT.amount]
    );

    await client.query(
        `INSERT INTO transactions (wallet_id, type, currency_to, amount_to, description)
         VALUES ($1, 'deposit', $2, $3, $4)`,
        [
            walletId,
            WELCOME_DEPOSIT.currency,
            WELCOME_DEPOSIT.amount,
            WELCOME_DEPOSIT.description,
        ]
    );
};

/*  Resumen de la billetera para el dashboard: saldo de cada moneda y
    cuántos USD vale cada una, para que el front calcule el total.

    change24h queda en 0 hasta que haya historial de cotizaciones. */
export const getWalletSummary = async (userId: string): Promise<WalletSummary> => {
    const wallet = await pool.query<{ id: string }>(
        "SELECT id FROM wallets WHERE user_id = $1",
        [userId]
    );

    // Todo usuario tiene billetera desde el registro. Si no aparece, el usuario
    // del token ya no existe: se trata como sesión inválida, igual que en /me.
    if (wallet.rowCount === 0) {
        throw new AppError("Token inválido o vencido", 401);
    }

    const { rows } = await pool.query<{ currency_code: string; amount: string }>(
        `SELECT currency_code, amount
         FROM balances
         WHERE wallet_id = $1
         ORDER BY currency_code`,
        [wallet.rows[0].id]
    );

    // pg devuelve NUMERIC como texto para no perder precisión. Para mostrar
    // saldos alcanza con Number(); los cálculos de plata se hacen en SQL.
    const balances = rows.map((row) => ({
        currency: row.currency_code,
        amount: Number(row.amount),
    }));

    return {
        balances,
        usdRates: await getUsdRates(balances.map((balance) => balance.currency)),
        change24h: 0,
    };
};

/*  Id de la billetera del usuario de la sesión.

    Recibe el `client` de la transacción en curso (o el pool) para que la
    consulta forme parte de la misma operación. Todo usuario tiene billetera
    desde el registro: si no aparece, el usuario del token ya no existe y se
    trata como sesión inválida, igual que en /me. */
export const findWalletId = async (
    db: Pick<PoolClient, "query">,
    userId: string
): Promise<string> => {
    const wallet = await db.query<{ id: string }>("SELECT id FROM wallets WHERE user_id = $1", [
        userId,
    ]);

    if (wallet.rowCount === 0) {
        throw new AppError("Token inválido o vencido", 401);
    }

    return wallet.rows[0].id;
};
