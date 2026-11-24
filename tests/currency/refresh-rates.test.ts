/*  refreshRates: guarda en exchange_rates las tasas con base USD.
    fetch se simula: los tests nunca llaman a las APIs reales.
    Se saltea si no hay DATABASE_URL_TEST configurada. */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshRates } from "../../src/currency/currency.service";
import { closeDatabase, hasTestDatabase, pool, resetDatabase } from "../helpers/db";

const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

// Simula fetch respondiendo según la API a la que se llama.
const mockApis = (handlers: {
    currencyFreaks: () => Promise<Response>;
    fixer?: () => Promise<Response>;
}) => {
    const fetchMock = vi.fn((input: URL | RequestInfo) => {
        const url = String(input);
        if (url.includes("currencyfreaks")) return handlers.currencyFreaks();
        if (url.includes("fixer") && handlers.fixer) return handlers.fixer();
        throw new Error(`fetch inesperado: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
};

const savedRates = async () => {
    const { rows } = await pool.query<{ quote_currency: string; rate: string; source: string }>(
        `SELECT quote_currency, rate, source
         FROM exchange_rates
         WHERE base_currency = 'USD'
         ORDER BY quote_currency`
    );
    return rows.map((row) => ({
        currency: row.quote_currency,
        rate: Number(row.rate),
        source: row.source,
    }));
};

// Respuesta de Fixer: base EUR (1 EUR = rate X), como en el plan gratuito.
const fixerResponse = {
    success: true,
    base: "EUR",
    rates: { ARS: 1680, COP: 4466, USD: 1.16 },
};

describe.skipIf(!hasTestDatabase)("refreshRates", () => {
    beforeEach(async () => {
        await resetDatabase();
        // Los errores esperados se loguean con console.error: se silencian.
        vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });
    afterAll(closeDatabase);

    it("guarda las tasas de Currency Freaks tal cual (ya vienen con base USD)", async () => {
        mockApis({
            currencyFreaks: async () =>
                json({ base: "USD", rates: { ARS: "1450.5", COP: "3850", EUR: "0.862" } }),
        });

        await refreshRates();

        expect(await savedRates()).toEqual([
            { currency: "ARS", rate: 1450.5, source: "currencyfreaks" },
            { currency: "COP", rate: 3850, source: "currencyfreaks" },
            { currency: "EUR", rate: 0.862, source: "currencyfreaks" },
        ]);
    });

    it("si Currency Freaks falla, convierte las tasas de Fixer de base EUR a base USD", async () => {
        mockApis({
            currencyFreaks: async () => json({ message: "error" }, 500),
            fixer: async () => json(fixerResponse),
        });

        await refreshRates();

        const rates = await savedRates();
        expect(rates.map((rate) => rate.currency)).toEqual(["ARS", "COP", "EUR"]);
        expect(rates.every((rate) => rate.source === "fixer")).toBe(true);

        const byCurrency = Object.fromEntries(rates.map((rate) => [rate.currency, rate.rate]));
        expect(byCurrency.ARS).toBeCloseTo(1680 / 1.16, 6);
        expect(byCurrency.COP).toBeCloseTo(4466 / 1.16, 6);
        // EUR es la base de Fixer: 1 USD = 1 / 1,16 EUR.
        expect(byCurrency.EUR).toBeCloseTo(1 / 1.16, 9);
    });

    it("cada consulta lleva un timeout; si Currency Freaks no responde a tiempo, usa Fixer", async () => {
        const fetchMock = mockApis({
            currencyFreaks: async () => {
                throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
            },
            fixer: async () => json(fixerResponse),
        });

        await refreshRates();

        for (const [, options] of fetchMock.mock.calls as unknown as [unknown, RequestInit][]) {
            expect(options.signal).toBeInstanceOf(AbortSignal);
        }
        expect((await savedRates()).every((rate) => rate.source === "fixer")).toBe(true);
    });

    it("si Fixer responde success = false, falla y no guarda nada", async () => {
        mockApis({
            currencyFreaks: async () => json({ message: "error" }, 500),
            fixer: async () =>
                json({ success: false, error: { code: 104, info: "Límite mensual alcanzado" } }),
        });

        await expect(refreshRates()).rejects.toThrow("Fixer devolvió un error");
        expect(await savedRates()).toEqual([]);
    });

    it("si Fixer no devuelve la tasa de USD, falla y no guarda nada", async () => {
        mockApis({
            currencyFreaks: async () => json({ message: "error" }, 500),
            fixer: async () => json({ success: true, base: "EUR", rates: { ARS: 1680, COP: 4466 } }),
        });

        await expect(refreshRates()).rejects.toThrow("Fixer no devolvió la tasa de USD");
        expect(await savedRates()).toEqual([]);
    });
});
