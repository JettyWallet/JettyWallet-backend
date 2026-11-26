/*  Utilidades para los tests que usan cotizaciones.

    - seedRates: guarda cotizaciones en exchange_rates (1 USD = rate X).
    - mockRatesApi: reemplaza fetch para que los tests nunca llamen a las
      APIs reales. Devuelve el mock para poder contar las llamadas.
      Recordar vi.unstubAllGlobals() en afterEach. */

import { vi } from "vitest";
import { pool } from "./db";

export const HOUR_MS = 60 * 60 * 1000;

export const seedRates = async (
    rates: Record<string, number>,
    fetchedAt: Date = new Date()
): Promise<void> => {
    for (const [code, rate] of Object.entries(rates)) {
        await pool.query(
            `INSERT INTO exchange_rates (base_currency, quote_currency, rate, source, fetched_at)
             VALUES ('USD', $1, $2, 'test', $3)`,
            [code, rate, fetchedAt]
        );
    }
};

// Currency Freaks responde con estas tasas (base USD), o falla si es null.
// Fixer siempre falla: los casos de respaldo se prueban en refresh-rates.test.ts.
export const mockRatesApi = (currencyFreaksRates: Record<string, number> | null) => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
        const url = String(input);
        if (url.includes("currencyfreaks") && currencyFreaksRates) {
            const rates = Object.fromEntries(
                Object.entries(currencyFreaksRates).map(([code, rate]) => [code, String(rate)])
            );
            return new Response(JSON.stringify({ base: "USD", rates }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }
        throw new Error(`API caída (simulada): ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
};
