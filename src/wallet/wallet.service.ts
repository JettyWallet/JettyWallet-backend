/*  Servicio de la billetera: saldos y operaciones sobre ellos. */

import { PoolClient } from "pg";
import { WELCOME_DEPOSIT } from "../config/wallet";

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
