/*  Reglas de negocio de la billetera que pueden cambiar con el tiempo.
    Tenerlas acá evita números sueltos en los servicios. */

// Depósito simulado que recibe cada usuario nuevo al registrarse (Demo 1).
export const WELCOME_DEPOSIT = {
    currency: "USD",
    amount: 1000,
    description: "Saldo de bienvenida",
} as const;

// Depósitos simulados. El máximo es por depósito (no limita el saldo total)
// y está en USD: en otras monedas es su equivalente según la última cotización
// (con 1 USD = 1.600 ARS, el máximo en ARS es 1.600.000.000).
export const DEPOSIT_RULES = {
    maxUsd: 1_000_000,
    description: "Depósito",
} as const;

// Intercambios entre monedas. Sin máximo: mueven saldo que el usuario ya tiene.
// Sin comisión por ahora (la tabla transactions ya admite fee_amount).
export const EXCHANGE_RULES = {
    description: "Intercambio",
} as const;
