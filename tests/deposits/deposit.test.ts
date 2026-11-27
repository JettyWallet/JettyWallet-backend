/*  POST /api/deposits.
    El caso sin sesión no necesita base de datos; el resto se saltea
    si no hay DATABASE_URL_TEST configurada.

    Cotizaciones de los tests (1 USD = X): EUR 0,86 · COP 3.800 · ARS 1.600.
    Máximo por depósito: el equivalente a 1.000.000 USD (ARS 1.600.000.000). */

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import { closeDatabase, hasTestDatabase, pool, resetDatabase } from "../helpers/db";
import { HOUR_MS, seedRates } from "../helpers/rates";

const validUser = { name: "Ana Pérez", email: "ana@mail.com", password: "12345678" };

const RATES = { EUR: 0.86, COP: 3800, ARS: 1600 };

// "Navegador" con la sesión ya iniciada: guarda la cookie y la reenvía.
const loggedInBrowser = async () => {
    const browser = request.agent(app);
    await browser.post("/api/auth/register").send(validUser).expect(201);
    return browser;
};

const balanceOf = async (currency: string): Promise<number> => {
    const { rows } = await pool.query<{ amount: string }>(
        "SELECT amount FROM balances WHERE currency_code = $1",
        [currency]
    );
    return Number(rows[0].amount);
};

const depositCount = async (): Promise<number> => {
    const { rows } = await pool.query<{ count: string }>(
        "SELECT count(*) FROM transactions WHERE type = 'deposit' AND description = 'Depósito'"
    );
    return Number(rows[0].count);
};

describe("POST /api/deposits sin base de datos", () => {
    it("sin sesión responde 401", async () => {
        const res = await request(app).post("/api/deposits").send({ currency: "USD", amount: 100 });

        expect(res.status).toBe(401);
    });
});

describe.skipIf(!hasTestDatabase)("POST /api/deposits", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedRates(RATES);
    });
    afterAll(closeDatabase);

    it("suma el monto al saldo y devuelve el movimiento y el saldo nuevo", async () => {
        const browser = await loggedInBrowser();

        const res = await browser.post("/api/deposits").send({ currency: "USD", amount: 250.5 });

        expect(res.status).toBe(201);
        expect(res.body.balance).toEqual({ currency: "USD", amount: 1250.5 });
        expect(res.body.transaction).toMatchObject({
            type: "deposit",
            fromCurrency: null,
            fromAmount: null,
            toCurrency: "USD",
            toAmount: 250.5,
        });
        expect(typeof res.body.transaction.id).toBe("string");
        expect(new Date(res.body.transaction.createdAt).toISOString()).toBe(
            res.body.transaction.createdAt
        );
        expect(await balanceOf("USD")).toBe(1250.5);
    });

    it("deposita en una moneda que estaba en 0 y acepta el código en minúsculas", async () => {
        const browser = await loggedInBrowser();

        const res = await browser.post("/api/deposits").send({ currency: "ars", amount: 50000 });

        expect(res.status).toBe(201);
        expect(res.body.balance).toEqual({ currency: "ARS", amount: 50000 });
        expect(await depositCount()).toBe(1);
    });

    it("el depósito aparece en el summary", async () => {
        const browser = await loggedInBrowser();
        await browser.post("/api/deposits").send({ currency: "EUR", amount: 99.99 }).expect(201);

        const summary = await browser.get("/api/wallet/summary");

        expect(summary.body.balances).toContainEqual({ currency: "EUR", amount: 99.99 });
    });

    describe("máximo por depósito según la moneda", () => {
        it("en USD acepta exactamente 1.000.000", async () => {
            const browser = await loggedInBrowser();

            const res = await browser.post("/api/deposits").send({ currency: "USD", amount: 1_000_000 });

            expect(res.status).toBe(201);
        });

        it("en USD rechaza con 422 un centavo más, sin tocar el saldo", async () => {
            const browser = await loggedInBrowser();

            const res = await browser
                .post("/api/deposits")
                .send({ currency: "USD", amount: 1_000_000.01 });

            expect(res.status).toBe(422);
            expect(res.body).toEqual({ message: "El monto máximo por depósito es 1.000.000 USD" });
            expect(await balanceOf("USD")).toBe(1000);
            expect(await depositCount()).toBe(0);
        });

        it("en ARS el máximo es el equivalente a 1.000.000 USD", async () => {
            const browser = await loggedInBrowser();

            const res = await browser
                .post("/api/deposits")
                .send({ currency: "ARS", amount: 1_600_000_000 });

            expect(res.status).toBe(201);
            expect(res.body.balance).toEqual({ currency: "ARS", amount: 1_600_000_000 });
        });

        it("en ARS rechaza con 422 un centavo más, con el máximo en ARS en el mensaje", async () => {
            const browser = await loggedInBrowser();

            const res = await browser
                .post("/api/deposits")
                .send({ currency: "ARS", amount: 1_600_000_000.01 });

            expect(res.status).toBe(422);
            expect(res.body).toEqual({
                message:
                    "El monto máximo por depósito es 1.600.000.000 ARS (equivale a 1.000.000 USD)",
            });
            expect(await balanceOf("ARS")).toBe(0);
            expect(await depositCount()).toBe(0);
        });

        it("en COP permite más de 1.000.000 (el caso que marcó el tutor)", async () => {
            const browser = await loggedInBrowser();

            const res = await browser.post("/api/deposits").send({ currency: "COP", amount: 5_000_000 });

            expect(res.status).toBe(201);
        });

        it("en EUR (vale más que el USD) el máximo es menor a 1.000.000", async () => {
            const browser = await loggedInBrowser();

            const res = await browser.post("/api/deposits").send({ currency: "EUR", amount: 900_000 });

            expect(res.status).toBe(422);
            expect(res.body.message).toBe(
                "El monto máximo por depósito es 860.000 EUR (equivale a 1.000.000 USD)"
            );
        });

        it("el máximo se trunca a 2 decimales (nunca supera el equivalente a 1.000.000 USD)", async () => {
            const browser = await loggedInBrowser();
            // 1.000.000 x 0,857142857143 = 857.142,857143: el máximo es 857.142,85.
            await pool.query(
                "UPDATE exchange_rates SET rate = 0.857142857142857 WHERE quote_currency = 'EUR'"
            );

            const exact = await browser.post("/api/deposits").send({ currency: "EUR", amount: 857_142.85 });
            const over = await browser.post("/api/deposits").send({ currency: "EUR", amount: 857_142.86 });

            expect(exact.status).toBe(201);
            expect(over.status).toBe(422);
            expect(over.body.message).toBe(
                "El monto máximo por depósito es 857.142,85 EUR (equivale a 1.000.000 USD)"
            );
        });

        it("con cotizaciones vencidas que no se pueden renovar, usa la última guardada", async () => {
            const browser = await loggedInBrowser();
            await pool.query("UPDATE exchange_rates SET fetched_at = $1", [
                new Date(Date.now() - 2 * HOUR_MS),
            ]);

            const ok = await browser.post("/api/deposits").send({ currency: "ARS", amount: 1_600_000_000 });
            const over = await browser.post("/api/deposits").send({ currency: "ARS", amount: 1_600_000_001 });

            expect(ok.status).toBe(201);
            expect(over.status).toBe(422);
        });

        it("sin ninguna cotización para la moneda responde 503 y no toca el saldo", async () => {
            const browser = await loggedInBrowser();
            await pool.query("DELETE FROM exchange_rates WHERE quote_currency = 'ARS'");

            const res = await browser.post("/api/deposits").send({ currency: "ARS", amount: 100 });

            expect(res.status).toBe(503);
            expect(await balanceOf("ARS")).toBe(0);
            expect(await depositCount()).toBe(0);
        });

        it("en USD no necesita cotizaciones", async () => {
            const browser = await loggedInBrowser();
            await pool.query("DELETE FROM exchange_rates");

            const res = await browser.post("/api/deposits").send({ currency: "USD", amount: 100 });

            expect(res.status).toBe(201);
        });
    });

    it.each([
        ["cero", 0],
        ["negativo", -50],
        ["más de 2 decimales", 10.555],
        ["texto", "100"],
        ["null", null],
        ["ausente", undefined],
    ])("rechaza con 400 un monto %s", async (_caso, amount) => {
        const browser = await loggedInBrowser();

        const res = await browser.post("/api/deposits").send({ currency: "USD", amount });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            message: "El monto tiene que ser un número mayor a 0 con hasta 2 decimales",
        });
        expect(await depositCount()).toBe(0);
    });

    it.each([
        ["con formato inválido", "dolar"],
        ["ausente", undefined],
    ])("rechaza con 400 una moneda %s", async (_caso, currency) => {
        const browser = await loggedInBrowser();

        const res = await browser.post("/api/deposits").send({ currency, amount: 100 });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: "Indicá una moneda válida (ARS, COP, EUR o USD)" });
    });

    it("rechaza con 400 una moneda que Jetty no maneja", async () => {
        const browser = await loggedInBrowser();

        const res = await browser.post("/api/deposits").send({ currency: "BTC", amount: 100 });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: "No se puede depositar en BTC" });
        expect(await depositCount()).toBe(0);
    });

    it("rechaza con 400 una moneda deshabilitada", async () => {
        const browser = await loggedInBrowser();
        // resetDatabase no restaura el catálogo de monedas: se vuelve a activar al final.
        await pool.query("UPDATE currencies SET is_active = FALSE WHERE code = 'COP'");

        try {
            const res = await browser.post("/api/deposits").send({ currency: "COP", amount: 100 });

            expect(res.status).toBe(400);
            expect(await depositCount()).toBe(0);
        } finally {
            await pool.query("UPDATE currencies SET is_active = TRUE WHERE code = 'COP'");
        }
    });

    it("depósitos simultáneos no se pisan: se suman todos", async () => {
        const browser = await loggedInBrowser();

        const responses = await Promise.all(
            Array.from({ length: 10 }, () =>
                browser.post("/api/deposits").send({ currency: "ARS", amount: 10.1 })
            )
        );

        expect(responses.every((res) => res.status === 201)).toBe(true);
        expect(await balanceOf("ARS")).toBe(101);
        expect(await depositCount()).toBe(10);
    });

    it("si el usuario de la sesión ya no existe responde 401", async () => {
        const browser = await loggedInBrowser();
        await pool.query("TRUNCATE transactions, balances, wallets, users CASCADE");

        const res = await browser.post("/api/deposits").send({ currency: "USD", amount: 100 });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Token inválido o vencido" });
    });
});
