/*  Depósitos simulados: suman dinero a un saldo de la billetera. */

import pool from "../config/database";
import { DEPOSIT_RULES } from "../config/wallet";
import { getQuote } from "../currency/currency.service";
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

// Decimales de las cotizaciones al calcular (los mismos que transactions.rate).
const RATE_DECIMALS = 12;

const formatAmount = (value: string): string =>
    Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 });

/*  Compara `amountText` con el máximo por depósito en `currency`: el
    equivalente a DEPOSIT_RULES.maxUsd según la última cotización guardada,
    truncado a 2 decimales.

    El máximo es maxUsd x (1 USD = X currency), con la cotización tal como está
    guardada (sin invertirla). La cuenta y la comparación se hacen en SQL con
    NUMERIC: sin errores de coma flotante justo en el límite. Truncar asegura
    que el máximo nunca supere el equivalente a maxUsd.

    Si las APIs externas fallan, usa la última cotización guardada (stale),
    igual que el intercambio. Si nunca hubo cotización, getQuote lanza 503. */
const checkMaxDeposit = async (
    currency: string,
    amountText: string
): Promise<{ max: string; exceeds: boolean }> => {
    const quote = await getQuote("USD", currency);
    const { rows } = await pool.query<{ max: string; exceeds: boolean }>(
        `SELECT max, $3::numeric > max AS exceeds
         FROM (SELECT TRUNC($1::numeric * $2::numeric, 2) AS max) m`,
        [DEPOSIT_RULES.maxUsd, quote.rate.toFixed(RATE_DECIMALS), amountText]
    );
    return rows[0];
};

/*  Suma `amount` al saldo de `currency` y registra el movimiento.

    Antes de abrir la transacción:
    1. Verifica que la moneda esté activa (si no, 400: es un dato inválido,
       no una falla de cotizaciones).
    2. Calcula el máximo en esa moneda (ver checkMaxDeposit). Si se supera, 422.
       Va antes de la transacción porque puede consultar una API externa.

    Después, en una misma transacción, suma al saldo y registra el movimiento:
    si falla el registro, el saldo vuelve a como estaba.

    `amount` llega validado (positivo, hasta 2 decimales).
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

    const active = await pool.query(
        "SELECT 1 FROM currencies WHERE code = $1 AND is_active",
        [currency]
    );
    if (active.rowCount === 0) {
        throw new AppError(`No se puede depositar en ${currency}`, 400);
    }

    const { max, exceeds } = await checkMaxDeposit(currency, amountText);
    if (exceeds) {
        const usdNote =
            currency === "USD"
                ? ""
                : ` (equivale a ${formatAmount(String(DEPOSIT_RULES.maxUsd))} USD)`;
        throw new AppError(
            `El monto máximo por depósito es ${formatAmount(max)} ${currency}${usdNote}`,
            422
        );
    }

    const result = await withTransaction(async (client) => {
        const walletId = await findWalletId(client, userId);

        // Se vuelve a pedir que la moneda esté activa: si la deshabilitan
        // entre la verificación de arriba y este UPDATE, no se actualiza nada.
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
