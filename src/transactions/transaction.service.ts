/*  Historial de movimientos de la billetera del usuario. */

import pool from "../config/database";
import { AppError } from "../utils/appError";
import {
    TRANSACTION_COLUMNS,
    TransactionDto,
    TransactionRow,
    toTransactionDto,
} from "../wallet/transaction.dto";
import { findWalletId } from "../wallet/wallet.service";

export interface TransactionFilters {
    limit: number;
    before?: string; // id del último movimiento que el front ya tiene
    type?: string; // deposit, exchange, transfer_in, transfer_out
    currency?: string; // movimientos donde entra o sale esa moneda
}

/*  Devuelve los movimientos de la billetera, más recientes primero.

    Paginación por cursor: con `before`, devuelve los movimientos anteriores
    a ese. A diferencia de ?page=N (OFFSET), no repite ni saltea movimientos
    si entran nuevos mientras el usuario mira el historial, y usa el índice
    idx_transactions_wallet_created (wallet_id, created_at DESC, id DESC).
    El id desempata movimientos con la misma fecha.

    La billetera sale de la sesión (userId), nunca de un parámetro: no hay
    forma de pedir movimientos de otro usuario. */
export const listTransactions = async (
    userId: string,
    { limit, before, type, currency }: TransactionFilters
): Promise<TransactionDto[]> => {
    const walletId = await findWalletId(pool, userId);

    const params: unknown[] = [walletId];
    const conditions = ["wallet_id = $1"];
    const addParam = (value: unknown): string => {
        params.push(value);
        return `$${params.length}`;
    };

    if (before) {
        // El cursor tiene que ser un movimiento de ESTA billetera: si no, 400,
        // sin dar pistas de si el id existe en otra.
        const cursor = await pool.query(
            "SELECT 1 FROM transactions WHERE id = $1 AND wallet_id = $2",
            [before, walletId]
        );
        if (cursor.rowCount === 0) {
            throw new AppError("El movimiento indicado en before no existe", 400);
        }

        // La fecha del cursor se lee en SQL (subconsulta), no en JavaScript:
        // created_at guarda microsegundos y Date de JS solo milisegundos.
        // Pasarla por JS podría saltear movimientos del mismo milisegundo.
        const p = addParam(before);
        conditions.push(
            `(created_at, id) < (SELECT created_at, id FROM transactions WHERE id = ${p})`
        );
    }

    if (type) {
        conditions.push(`type = ${addParam(type)}`);
    }

    if (currency) {
        const p = addParam(currency);
        conditions.push(`(currency_from = ${p} OR currency_to = ${p})`);
    }

    const { rows } = await pool.query<TransactionRow>(
        `SELECT ${TRANSACTION_COLUMNS}
         FROM transactions
         WHERE ${conditions.join(" AND ")}
         ORDER BY created_at DESC, id DESC
         LIMIT ${addParam(limit)}`,
        params
    );

    return rows.map(toTransactionDto);
};
