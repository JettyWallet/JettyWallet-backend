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

// Tiempo máximo de espera de cada API externa. Si se cuelga, la consulta
// falla y se pasa al respaldo (o a la última cotización guardada).
const FETCH_TIMEOUT_MS = 5000;

const fetchWithTimeout = (url: URL): Promise<Response> =>
    fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

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

    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`Currency Freaks respondió ${response.status}`);

    const data = (await response.json()) as { rates: Record<string, string> };
    const rates: Record<string, number> = {};
    for (const [code, value] of Object.entries(data.rates)) {
        rates[code] = Number(value);
    }
    return rates;
};

/*  Respaldo. El plan gratuito de Fixer (100 consultas por mes) no permite
    elegir la base: las tasas vienen relativas a EUR (1 EUR = rate X).
    Por eso se pide también USD y se convierte cada tasa a base USD:

        tasa(USD -> X) = tasa(EUR -> X) / tasa(EUR -> USD)

    Ejemplo: 1 EUR = 1,16 USD y 1 EUR = 1.680 ARS  =>  1 USD = 1.448 ARS. */
const fetchFromFixer = async (codes: string[]): Promise<Record<string, number>> => {
    const url = new URL("https://data.fixer.io/api/latest");
    url.searchParams.set("access_key", env.fixerApiKey ?? "");
    url.searchParams.set("symbols", [...codes, BASE_CURRENCY].join(","));

    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`Fixer respondió ${response.status}`);

    // Fixer responde 200 también ante errores (clave inválida, límite mensual):
    // lo que indica el error es success = false.
    const data = (await response.json()) as {
        success: boolean;
        base?: string;
        rates?: Record<string, number>;
    };
    if (!data.success || !data.rates) throw new Error("Fixer devolvió un error");

    const fixerBase = data.base ?? "EUR";
    const basePerUsd = fixerBase === BASE_CURRENCY ? 1 : data.rates[BASE_CURRENCY];
    if (!(basePerUsd > 0)) throw new Error(`Fixer no devolvió la tasa de ${BASE_CURRENCY}`);

    const rates: Record<string, number> = {};
    for (const code of codes) {
        // La base de Fixer no viene en rates (1 EUR = 1 EUR): se completa a mano.
        const perBase = code === fixerBase ? 1 : data.rates[code];
        if (perBase > 0) rates[code] = perBase / basePerUsd;
    }
    return rates;
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
