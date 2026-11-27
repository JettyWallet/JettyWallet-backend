/*  Reglas de negocio de la billetera que pueden cambiar con el tiempo.
    Tenerlas acá evita números sueltos en los servicios. */

// Depósito simulado que recibe cada usuario nuevo al registrarse (Demo 1).
export const WELCOME_DEPOSIT = {
    currency: "USD",
    amount: 1000,
    description: "Saldo de bienvenida",
} as const;

// Depósitos simulados. El máximo es por depósito, no limita el saldo total.
export const DEPOSIT_RULES = {
    maxAmount: 1_000_000,
    description: "Depósito",
} as const;

// Intercambios entre monedas. Sin máximo: mueven saldo que el usuario ya tiene.
// Sin comisión por ahora (la tabla transactions ya admite fee_amount).
export const EXCHANGE_RULES = {
    description: "Intercambio",
} as const;
