/*  Validaciones de datos que llegan en el body y comparten varios módulos
    (depósitos, intercambios, transferencias...). Así todas las operaciones
    aceptan exactamente los mismos montos y códigos de moneda. */

// Número positivo con hasta 2 decimales, escrito en notación común.
// String(0.1 + 0.2) es "0.30000000000000004" y String(1e-7) es "1e-7":
// los dos se rechazan, que es lo correcto para un monto de dinero.
const MONEY_FORMAT = /^\d+(\.\d{1,2})?$/;

const CURRENCY_FORMAT = /^[A-Z]{3}$/;

// Devuelve el código normalizado ("ars " -> "ARS") o null si no tiene formato
// de código de moneda. No dice si Jetty maneja esa moneda: eso lo resuelve la base.
export const parseCurrencyCode = (value: unknown): string | null => {
    const code = typeof value === "string" ? value.trim().toUpperCase() : "";
    return CURRENCY_FORMAT.test(code) ? code : null;
};

// true si es un número mayor a 0 con hasta 2 decimales.
export const isValidMoneyAmount = (value: unknown): value is number =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    MONEY_FORMAT.test(String(value));

export const INVALID_AMOUNT_MESSAGE =
    "El monto tiene que ser un número mayor a 0 con hasta 2 decimales";
