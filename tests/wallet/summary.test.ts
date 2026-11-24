/*  GET /api/wallet/summary.
    El caso sin token no necesita base de datos; el resto se saltea
    si no hay DATABASE_URL_TEST configurada. */

import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import { REFERENCE_USD_RATES } from "../../src/config/rates";
import { closeDatabase, hasTestDatabase, pool, resetDatabase } from "../helpers/db";

// Registra un usuario por la API (con sus saldos iniciales) y devuelve su token.
const registerAndGetToken = async (): Promise<string> => {
    const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Ana Pérez", email: "ana@mail.com", password: "12345678" });

    return res.body.token;
};

const getSummary = (token: string) =>
    request(app).get("/api/wallet/summary").set("Authorization", `Bearer ${token}`);

describe("GET /api/wallet/summary sin base de datos", () => {
    it("sin token responde 401", async () => {
        const res = await request(app).get("/api/wallet/summary");

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Token no enviado" });
    });
});

describe.skipIf(!hasTestDatabase)("GET /api/wallet/summary", () => {
    beforeEach(resetDatabase);
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

    it("sin cotizaciones guardadas usa las de referencia", async () => {
        const res = await getSummary(await registerAndGetToken());

        expect(res.body.usdRates).toEqual({
            ARS: REFERENCE_USD_RATES.ARS,
            COP: REFERENCE_USD_RATES.COP,
            EUR: REFERENCE_USD_RATES.EUR,
            USD: 1,
        });
    });

    it("con cotización guardada la usa, invertida (1 ARS = 1/rate USD)", async () => {
        const token = await registerAndGetToken();
        await pool.query(
            `INSERT INTO exchange_rates (base_currency, quote_currency, rate, source)
             VALUES ('USD', 'ARS', 1250, 'test')`
        );

        const res = await getSummary(token);

        expect(res.body.usdRates.ARS).toBeCloseTo(1 / 1250, 12);
        // Las que no están guardadas siguen usando la de referencia.
        expect(res.body.usdRates.EUR).toBe(REFERENCE_USD_RATES.EUR);
        expect(res.body.usdRates.USD).toBe(1);
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
