/*  Intercambios: pasar saldo de una moneda a otra de la misma billetera. */

import pool from "../config/database";
import { EXCHANGE_RULES } from "../config/wallet";
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

export interface ExchangeResult {
    transaction: TransactionDto;
    // Saldos nuevos de las dos monedas: primero la de origen, después la de destino.
    balances: { currency: string; amount: number }[];
}

// Decimales de la columna transactions.rate (NUMERIC(24, 12)).
const RATE_DECIMALS = 12;

/*  Cambia `amount` de `fromCurrency` a `toCurrency` con la cotización actual.

    Pasos:
    1. Verifica que las dos monedas estén activas (si no, 400: es un dato
       inválido, no una falla de cotizaciones).
    2. Pide la cotización ANTES de abrir la transacción: puede consultar una
       API externa (hasta 5 s) y no conviene tener filas bloqueadas mientras tanto.
    3. En una transacción:
       a. Bloquea las dos filas de saldo, siempre en el mismo orden (alfabético).
          Si el mismo usuario hace USD->EUR y EUR->USD a la vez, la segunda
          operación espera a la primera en lugar de quedar trabadas (deadlock).
       b. Calcula lo que recibe en SQL: TRUNC(amount x rate, 2). Se trunca
          (no se redondea) para no crear centavos que no existen. Si da 0, 422.
       c. Debita solo si alcanza el saldo (amount >= $). Si no, 422.
       d. Acredita el destino y registra el movimiento.
       Si algo falla, el ROLLBACK deshace todo: nunca hay débito sin crédito.

    `amount` llega validado (positivo, hasta 2 decimales) y las monedas son
    distintas y con formato válido (lo controla el controller). */
export const createExchange = async (
    userId: string,
    fromCurrency: string,
    toCurrency: string,
    amount: number
): Promise<ExchangeResult> => {
    const active = await pool.query<{ code: string }>(
        "SELECT code FROM currencies WHERE code = ANY($1::varchar[]) AND is_active",
        [[fromCurrency, toCurrency]]
    );
    if (active.rowCount !== 2) {
        throw new AppError(`No se puede intercambiar entre ${fromCurrency} y ${toCurrency}`, 400);
    }

    // 503 si no hay ninguna cotización para el par. Si las APIs externas fallan
    // pero hay una guardada (stale), se usa esa: es la misma que ve el front.
    const quote = await getQuote(fromCurrency, toCurrency);

    // Texto con los decimales de la columna: lo que se guarda en `rate` es
    // exactamente lo que se usa para calcular, así el movimiento es verificable.
    const rateText = quote.rate.toFixed(RATE_DECIMALS);
    const amountText = amount.toFixed(2);

    const result = await withTransaction(async (client) => {
        const walletId = await findWalletId(client, userId);

        await client.query(
            `SELECT 1 FROM balances
             WHERE wallet_id = $1 AND currency_code = ANY($2::varchar[])
             ORDER BY currency_code
             FOR UPDATE`,
            [walletId, [fromCurrency, toCurrency]]
        );

        const converted = await client.query<{ received: string }>(
            "SELECT TRUNC($1::numeric * $2::numeric, 2) AS received",
            [amountText, rateText]
        );
        const received = converted.rows[0].received;

        if (Number(received) <= 0) {
            throw new AppError(
                `El monto es demasiado chico para convertirlo a ${toCurrency}`,
                422
            );
        }

        // El WHERE amount >= $3 hace la verificación y el débito en un solo paso.
        const debited = await client.query<{ amount: string }>(
            `UPDATE balances
             SET amount = amount - $3::numeric
             WHERE wallet_id = $1 AND currency_code = $2 AND amount >= $3::numeric
             RETURNING amount`,
            [walletId, fromCurrency, amountText]
        );

        if (debited.rowCount === 0) {
            throw new AppError(
                `No tenés saldo suficiente en ${fromCurrency} para este intercambio`,
                422
            );
        }

        const credited = await client.query<{ amount: string }>(
            `UPDATE balances
             SET amount = amount + $3::numeric
             WHERE wallet_id = $1 AND currency_code = $2
             RETURNING amount`,
            [walletId, toCurrency, received]
        );

        // Una billetera tiene saldo en todas las monedas activas desde que se crea.
        // Si falta la fila, es un dato roto: se corta todo con un 500.
        if (credited.rowCount === 0) {
            throw new Error(`La billetera ${walletId} no tiene saldo en ${toCurrency}`);
        }

        const transaction = await client.query<TransactionRow>(
            `INSERT INTO transactions
                 (wallet_id, type, currency_from, amount_from, currency_to, amount_to, rate, description)
             VALUES ($1, 'exchange', $2, $3, $4, $5, $6, $7)
             RETURNING ${TRANSACTION_COLUMNS}`,
            [
                walletId,
                fromCurrency,
                amountText,
                toCurrency,
                received,
                rateText,
                EXCHANGE_RULES.description,
            ]
        );

        return {
            transaction: toTransactionDto(transaction.rows[0]),
            balances: [
                { currency: fromCurrency, amount: Number(debited.rows[0].amount) },
                { currency: toCurrency, amount: Number(credited.rows[0].amount) },
            ],
        };
    });

    // Acá, ya confirmado el intercambio, se va a enviar el mail de aviso
    // (notifyExchange del servicio de notificaciones). Si el mail falla,
    // el intercambio no se deshace.

    return result;
};
