/*  Valor en USD de cada moneda, para mostrar totales (no para operar).

    exchange_rates guarda "1 USD = rate unidades de X". Acá se invierte:
    1 unidad de X = 1 / rate USD.

    Lee solo lo que ya está guardado en la base: no llama a las APIs
    externas, así una pantalla de resumen nunca queda esperando ni falla
    porque una API no responda. Si falta una cotización, se usa la de
    referencia (config/rates.ts). */

import pool from "../config/database";
import { REFERENCE_USD_RATES } from "../config/rates";

const BASE_CURRENCY = "USD";

export const getUsdRates = async (codes: string[]): Promise<Record<string, number>> => {
    const { rows } = await pool.query<{ quote_currency: string; rate: string }>(
        `SELECT quote_currency, rate
         FROM exchange_rates
         WHERE base_currency = $1 AND quote_currency = ANY($2)`,
        [BASE_CURRENCY, codes]
    );

    const stored = new Map(rows.map((row) => [row.quote_currency, 1 / Number(row.rate)]));

    const usdRates: Record<string, number> = {};

    for (const code of codes) {
        const rate = code === BASE_CURRENCY ? 1 : stored.get(code) ?? REFERENCE_USD_RATES[code];

        if (rate === undefined) {
            console.warn(`Sin cotización ni valor de referencia para ${code}`);
            continue;
        }

        usdRates[code] = rate;
    }

    return usdRates;
};
