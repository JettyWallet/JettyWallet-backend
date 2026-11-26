/*  GET /api/rates: cotizaciones vigentes, con refresco perezoso cada 1 hora.
    fetch se simula: nunca se llama a las APIs reales.
    Se saltea si no hay DATABASE_URL_TEST configurada. */

import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app";
import { closeDatabase, hasTestDatabase, pool, resetDatabase } from "../helpers/db";
import { HOUR_MS, mockRatesApi, seedRates } from "../helpers/rates";

const countApiCalls = (fetchMock: ReturnType<typeof mockRatesApi>, api: string) =>
    fetchMock.mock.calls.filter(([url]) => String(url).includes(api)).length;

describe.skipIf(!hasTestDatabase)("GET /api/rates", () => {
    beforeEach(async () => {
        await resetDatabase();
        // Los fallos simulados de las APIs se loguean: se silencian.
        vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });
    afterAll(closeDatabase);

    it("con cotizaciones frescas responde sin llamar a las APIs, invertidas a 'USD por unidad'", async () => {
        const fetchedAt = new Date(Date.now() - 10 * 60 * 1000);
        await seedRates({ ARS: 1250, COP: 4000, EUR: 0.8 }, fetchedAt);
        const fetchMock = mockRatesApi(null);

        const res = await request(app).get("/api/rates");

        expect(res.status).toBe(200);
        expect(res.body.base).toBe("USD");
        expect(res.body.usdRates.USD).toBe(1);
        expect(res.body.usdRates.ARS).toBeCloseTo(1 / 1250, 12);
        expect(res.body.usdRates.COP).toBeCloseTo(1 / 4000, 12);
        expect(res.body.usdRates.EUR).toBeCloseTo(1.25, 12);
        expect(res.body.stale).toBe(false);
        expect(res.body.updatedAt).toBe(fetchedAt.toISOString());
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("es pública: no necesita sesión", async () => {
        await seedRates({ ARS: 1250, COP: 4000, EUR: 0.8 });
        mockRatesApi(null);

        const res = await request(app).get("/api/rates");

        expect(res.status).toBe(200);
    });

    it("sin cotizaciones guardadas, las trae de la API y las guarda", async () => {
        mockRatesApi({ ARS: 1450, COP: 3850, EUR: 0.86 });

        const res = await request(app).get("/api/rates");

        expect(res.status).toBe(200);
        expect(res.body.usdRates.ARS).toBeCloseTo(1 / 1450, 12);
        expect(res.body.stale).toBe(false);

        const { rowCount } = await pool.query("SELECT 1 FROM exchange_rates");
        expect(rowCount).toBe(3);
    });

    it("con cotizaciones de más de 1 hora, las renueva", async () => {
        await seedRates({ ARS: 1250, COP: 4000, EUR: 0.8 }, new Date(Date.now() - 2 * HOUR_MS));
        mockRatesApi({ ARS: 1450, COP: 3850, EUR: 0.86 });

        const res = await request(app).get("/api/rates");

        expect(res.body.usdRates.ARS).toBeCloseTo(1 / 1450, 12);
        expect(res.body.stale).toBe(false);
    });

    it("si no se pueden renovar, devuelve las guardadas marcadas como vencidas", async () => {
        await seedRates({ ARS: 1250, COP: 4000, EUR: 0.8 }, new Date(Date.now() - 2 * HOUR_MS));
        mockRatesApi(null);

        const res = await request(app).get("/api/rates");

        expect(res.status).toBe(200);
        expect(res.body.usdRates.ARS).toBeCloseTo(1 / 1250, 12);
        expect(res.body.stale).toBe(true);
    });

    it("si alguna moneda nunca tuvo cotización y las APIs fallan, responde 503", async () => {
        mockRatesApi(null);

        const res = await request(app).get("/api/rates");

        expect(res.status).toBe(503);
        expect(res.body).toEqual({
            message: "Las cotizaciones no están disponibles en este momento",
        });
    });

    it("varios pedidos simultáneos comparten una sola consulta a la API", async () => {
        const fetchMock = mockRatesApi({ ARS: 1450, COP: 3850, EUR: 0.86 });

        const responses = await Promise.all(
            Array.from({ length: 5 }, () => request(app).get("/api/rates"))
        );

        expect(responses.every((res) => res.status === 200)).toBe(true);
        expect(countApiCalls(fetchMock, "currencyfreaks")).toBe(1);
    });
});
