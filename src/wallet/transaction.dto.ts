/*  Forma en que la API devuelve un movimiento (tipo Transaction del front).
    La comparten depósitos, intercambios, transferencias y el historial. */

export interface TransactionDto {
    id: string;
    type: string;
    fromCurrency: string | null; // null en depósitos
    fromAmount: number | null; // null en depósitos
    toCurrency: string;
    toAmount: number;
    description: string | null; // texto para mostrar, ej. "Saldo de bienvenida"
    createdAt: string; // ISO 8601
}

// Columnas a pedir en el RETURNING o el SELECT para poder armar el DTO.
export const TRANSACTION_COLUMNS =
    "id, type, currency_from, amount_from, currency_to, amount_to, description, created_at";

export interface TransactionRow {
    id: string;
    type: string;
    currency_from: string | null;
    amount_from: string | null;
    currency_to: string;
    amount_to: string;
    description: string | null;
    created_at: Date;
}

// pg devuelve NUMERIC como texto: se convierte a número solo para responder.
export const toTransactionDto = (row: TransactionRow): TransactionDto => ({
    id: row.id,
    type: row.type,
    fromCurrency: row.currency_from,
    fromAmount: row.amount_from === null ? null : Number(row.amount_from),
    toCurrency: row.currency_to,
    toAmount: Number(row.amount_to),
    description: row.description,
    createdAt: row.created_at.toISOString(),
});
