/*  Depósitos simulados: suman dinero a un saldo de la billetera. */

import { DEPOSIT_RULES } from "../config/wallet";
import { AppError } from "../utils/appError";
import { withTransaction } from "../utils/withTransaction";
import {
    TRANSACTION_COLUMNS,
    TransactionDto,
    TransactionRow,
    toTransactionDto,
} from "../wallet/transaction.dto";
import { findWalletId } from "../wallet/wallet.service";

export interface DepositResult {
    transaction: TransactionDto;
    balance: { currency: string; amount: number };
}

/*  Suma `amount` al saldo de `currency` y registra el movimiento.

    Las dos cosas van en una misma transacción: si falla el registro del
    movimiento, el saldo vuelve a como estaba.

    `amount` llega validado (positivo, hasta 2 decimales, dentro del máximo).
    El UPDATE suma sobre el valor actual de la fila (amount = amount + $3), así
    que dos depósitos simultáneos no se pisan: PostgreSQL los aplica de a uno. */
export const createDeposit = async (
    userId: string,
    currency: string,
    amount: number
): Promise<DepositResult> => {
    // Se manda como texto con 2 decimales para que PostgreSQL lo guarde exacto
    // en NUMERIC, sin pasar por la representación binaria de los floats.
    const amountText = amount.toFixed(2);

    const result = await withTransaction(async (client) => {
        const walletId = await findWalletId(client, userId);

        // Solo monedas activas. Si la moneda no existe o está deshabilitada,
        // no se actualiza ninguna fila.
        const balance = await client.query<{ amount: string }>(
            `UPDATE balances b
             SET amount = b.amount + $3::numeric
             FROM currencies c
             WHERE c.code = b.currency_code
               AND c.is_active
               AND b.wallet_id = $1
               AND b.currency_code = $2
             RETURNING b.amount`,
            [walletId, currency, amountText]
        );

        if (balance.rowCount === 0) {
            throw new AppError(`No se puede depositar en ${currency}`, 400);
        }

        const transaction = await client.query<TransactionRow>(
            `INSERT INTO transactions (wallet_id, type, currency_to, amount_to, description)
             VALUES ($1, 'deposit', $2, $3, $4)
             RETURNING ${TRANSACTION_COLUMNS}`,
            [walletId, currency, amountText, DEPOSIT_RULES.description]
        );

        return {
            transaction: toTransactionDto(transaction.rows[0]),
            balance: { currency, amount: Number(balance.rows[0].amount) },
        };
    });

    // Acá, ya confirmado el depósito, se va a enviar el mail de aviso
    // (notifyDeposit del servicio de notificaciones). Si el mail falla,
    // el depósito no se deshace.

    return result;
};
