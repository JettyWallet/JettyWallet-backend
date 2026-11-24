/*  Servicio de monedas y cotizaciones.

    La tabla exchange_rates guarda pares directos (1 base = rate quote).
    Este servicio carga solo filas con base USD. Para convertir A -> B:
    tasa(USD -> B) / tasa(USD -> A).

    Si la cotización de USD tiene más de CACHE_TTL_HOURS horas, se refresca
    desde Currency Freaks. Si esa API falla, se usa Fixer como respaldo.
    Si ninguna responde, se usa la última cotización guardada, marcada como vencida. */

import pool from "../config/database";
import { env } from "../config/env";
import { AppError } from "../utils/appError";

const BASE_CURRENCY = "USD";
const CACHE_TTL_HOURS = 12;

export interface Quote {
    from: string;
    to: string;
    rate: number;
    source: string;
    fetchedAt: Date;
    stale: boolean;
}

const isStale = (fetchedAt: Date): boolean => {
    const ageMs = Date.now() - fetchedAt.getTime();
    return ageMs > CACHE_TTL_HOURS * 60 * 60 * 1000;
};

const fetchFromCurrencyFreaks = async (codes: string[]): Promise<Record<string, number>> => {
    const url = new URL("https://api.currencyfreaks.com/v2.0/rates/latest");
    url.searchParams.set("apikey", env.currencyFreaksApiKey ?? "");
    url.searchParams.set("symbols", codes.join(","));

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Currency Freaks respondió ${response.status}`);

    const data = (await response.json()) as { rates: Record<string, string> };
    const rates: Record<string, number> = {};
    for (const [code, value] of Object.entries(data.rates)) {
        rates[code] = Number(value);
    }
    return rates;
};

// Respaldo. En el plan gratuito de Fixer puede no estar disponible una moneda; revisar el plan antes de depender de este respaldo.
const fetchFromFixer = async (codes: string[]): Promise<Record<string, number>> => {
    const url = new URL("https://data.fixer.io/api/latest");
    url.searchParams.set("access_key", env.fixerApiKey ?? "");
    url.searchParams.set("symbols", codes.join(","));

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fixer respondió ${response.status}`);

    const data = (await response.json()) as { success: boolean; rates?: Record<string, number> };
    if (!data.success || !data.rates) throw new Error("Fixer devolvió un error");
    return data.rates;
};

const saveRates = async (rates: Record<string, number>, source: string): Promise<void> => {
    const now = new Date();
    for (const [code, rate] of Object.entries(rates)) {
        if (!(rate > 0)) continue;
        await pool.query(
            `INSERT INTO exchange_rates (base_currency, quote_currency, rate, source, fetched_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (base_currency, quote_currency)
             DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, fetched_at = EXCLUDED.fetched_at`,
            [BASE_CURRENCY, code, rate, source, now]
        );
    }
};

// Refresca las tasas desde Currency Freaks y, si falla, desde Fixer.
export const refreshRates = async (): Promise<void> => {
    const { rows } = await pool.query<{ code: string }>(
        "SELECT code FROM currencies WHERE is_active = TRUE AND code <> $1",
        [BASE_CURRENCY]
    );
    const codes = rows.map((row) => row.code);
    if (codes.length === 0) return;

    try {
        await saveRates(await fetchFromCurrencyFreaks(codes), "currencyfreaks");
    } catch (primaryError) {
        console.error("Falló Currency Freaks, usando Fixer:", primaryError);
        await saveRates(await fetchFromFixer(codes), "fixer");
    }
};

const getUsdRate = async (code: string): Promise<{ rate: number; fetchedAt: Date } | null> => {
    if (code === BASE_CURRENCY) {
        return { rate: 1, fetchedAt: new Date() };
    }

    const { rows } = await pool.query<{ rate: string; fetched_at: Date }>(
        "SELECT rate, fetched_at FROM exchange_rates WHERE base_currency = $1 AND quote_currency = $2",
        [BASE_CURRENCY, code]
    );
    if (rows.length === 0) return null;
    return { rate: Number(rows[0].rate), fetchedAt: rows[0].fetched_at };
};

// Devuelve cuántas unidades de "to" equivale a una unidad de "from".
export const getQuote = async (from: string, to: string): Promise<Quote> => {
    if (from === to) {
        return { from, to, rate: 1, source: "local", fetchedAt: new Date(), stale: false };
    }

    let fromRate = await getUsdRate(from);
    let toRate = await getUsdRate(to);

    const needsRefresh =
        !fromRate || !toRate || isStale(fromRate.fetchedAt) || isStale(toRate.fetchedAt);

    if (needsRefresh) {
        try {
            await refreshRates();
        } catch (error) {
            console.error("No se pudieron actualizar las cotizaciones:", error);
        }
        fromRate = await getUsdRate(from);
        toRate = await getUsdRate(to);
    }

    if (!fromRate || !toRate) {
        throw new AppError(`No hay cotización disponible para ${from} -> ${to}`, 503);
    }

    const oldestFetch = new Date(Math.min(fromRate.fetchedAt.getTime(), toRate.fetchedAt.getTime()));

    return {
        from,
        to,
        rate: toRate.rate / fromRate.rate,
        source: "cache",
        fetchedAt: oldestFetch,
        stale: isStale(oldestFetch),
    };
};
