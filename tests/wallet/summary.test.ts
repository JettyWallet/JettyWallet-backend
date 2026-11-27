/*  GET /api/wallet/summary.
    El caso sin token no necesita base de datos; el resto se saltea
    si no hay DATABASE_URL_TEST configurada. */

import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app";
import { closeDatabase, hasTestDatabase, pool, resetDatabase } from "../helpers/db";
import { mockRatesApi, seedRates } from "../helpers/rates";
import { sessionCookie, sessionToken } from "../helpers/session";

// Registra un usuario por la API (con sus saldos iniciales) y devuelve el JWT de su cookie.
const registerAndGetToken = async (): Promise<string> => {
    const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Ana Pérez", email: "ana@mail.com", password: "12345678" });

    return sessionToken(res)!;
};

const getSummary = (token: string) =>
    request(app).get("/api/wallet/summary").set("Cookie", sessionCookie(token));

describe("GET /api/wallet/summary sin base de datos", () => {
    it("sin token responde 401", async () => {
        const res = await request(app).get("/api/wallet/summary");

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Token no enviado" });
    });
});

describe.skipIf(!hasTestDatabase)("GET /api/wallet/summary", () => {
    beforeEach(async () => {
        await resetDatabase();
        // Las APIs de cotizaciones están "caídas" salvo que el test diga otra cosa.
        mockRatesApi(null);
        vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });
    afterAll(closeDatabase);

    it("un usuario nuevo ve 1.000 USD y el resto de las monedas en 0", async () => {
        const res = await getSummary(await registerAndGetToken());

        expect(res.status).toBe(200);
        expect(res.body.balances).toEqual([
            { currency: "ARS", amount: 0 },
            { currency: "COP", amount: 0 },
            { currency: "EUR", amount: 0 },
            { currency: "USD", amount: 1000 },
        ]);
        expect(res.body.change24h).toBe(0);
    });

    it("usa las cotizaciones guardadas, invertidas (1 ARS = 1/rate USD)", async () => {
        const token = await registerAndGetToken();
        await seedRates({ ARS: 1250, COP: 4000, EUR: 0.8 });

        const res = await getSummary(token);

        expect(res.body.usdRates.ARS).toBeCloseTo(1 / 1250, 12);
        expect(res.body.usdRates.COP).toBeCloseTo(1 / 4000, 12);
        expect(res.body.usdRates.EUR).toBeCloseTo(1.25, 12);
        expect(res.body.usdRates.USD).toBe(1);
    });

    it("sin cotizaciones guardadas, las trae de la API", async () => {
        const token = await registerAndGetToken();
        mockRatesApi({ ARS: 1450, COP: 3850, EUR: 0.86 });

        const res = await getSummary(token);

        expect(res.body.usdRates.ARS).toBeCloseTo(1 / 1450, 12);
    });

    it("si nunca hubo cotizaciones y las APIs fallan, muestra los saldos con usdRates solo de USD", async () => {
        const res = await getSummary(await registerAndGetToken());

        expect(res.status).toBe(200);
        expect(res.body.balances).toHaveLength(4);
        expect(res.body.usdRates).toEqual({ USD: 1 });
    });

    it("refleja los saldos actuales de la billetera", async () => {
        const token = await registerAndGetToken();
        await pool.query("UPDATE balances SET amount = 2500.75 WHERE currency_code = 'EUR'");

        const res = await getSummary(token);

        expect(res.body.balances).toContainEqual({ currency: "EUR", amount: 2500.75 });
    });

    it("si el usuario del token ya no existe responde 401", async () => {
        const token = jwt.sign({ userId: randomUUID() }, process.env.JWT_SECRET!);

        const res = await getSummary(token);

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Token inválido o vencido" });
    });
});
