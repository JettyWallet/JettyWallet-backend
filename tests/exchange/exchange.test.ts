/*  POST /api/exchange.
    El caso sin sesión no necesita base de datos; el resto se saltea
    si no hay DATABASE_URL_TEST configurada.

    Cotizaciones de los tests (1 USD = X): EUR 0,86 · COP 3.800 · ARS 1.600.
    fetch real está bloqueado (tests/setup/env.ts): si las cotizaciones vencen,
    la renovación falla y se usan las guardadas. */

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import { closeDatabase, hasTestDatabase, pool, resetDatabase } from "../helpers/db";
import { HOUR_MS, seedRates } from "../helpers/rates";

const validUser = { name: "Ana Pérez", email: "ana@mail.com", password: "12345678" };

const RATES = { EUR: 0.86, COP: 3800, ARS: 1600 };

// "Navegador" con la sesión ya iniciada. Arranca con 1.000 USD (bienvenida).
const loggedInBrowser = async () => {
    const browser = request.agent(app);
    await browser.post("/api/auth/register").send(validUser).expect(201);
    return browser;
};

type Browser = Awaited<ReturnType<typeof loggedInBrowser>>;

const deposit = (browser: Browser, currency: string, amount: number) =>
    browser.post("/api/deposits").send({ currency, amount }).expect(201);

const exchange = (browser: Browser, fromCurrency: string, toCurrency: string, amount: unknown) =>
    browser.post("/api/exchange").send({ fromCurrency, toCurrency, amount });

const balanceOf = async (currency: string): Promise<number> => {
    const { rows } = await pool.query<{ amount: string }>(
        "SELECT amount FROM balances WHERE currency_code = $1",
        [currency]
    );
    return Number(rows[0].amount);
};

const exchangeCount = async (): Promise<number> => {
    const { rows } = await pool.query<{ count: string }>(
        "SELECT count(*) FROM transactions WHERE type = 'exchange'"
    );
    return Number(rows[0].count);
};

describe("POST /api/exchange sin base de datos", () => {
    it("sin sesión responde 401", async () => {
        const res = await request(app)
            .post("/api/exchange")
            .send({ fromCurrency: "USD", toCurrency: "EUR", amount: 100 });

        expect(res.status).toBe(401);
    });
});

describe.skipIf(!hasTestDatabase)("POST /api/exchange", () => {
    beforeEach(resetDatabase);
    afterAll(closeDatabase);

    describe("con cotizaciones", () => {
        beforeEach(() => seedRates(RATES));

        it("debita el origen, acredita el destino y devuelve el movimiento y los dos saldos", async () => {
            const browser = await loggedInBrowser();

            const res = await exchange(browser, "USD", "EUR", 100);

            expect(res.status).toBe(201);
            expect(res.body.balances).toEqual([
                { currency: "USD", amount: 900 },
                { currency: "EUR", amount: 86 },
            ]);
            expect(res.body.transaction).toMatchObject({
                type: "exchange",
                fromCurrency: "USD",
                fromAmount: 100,
                toCurrency: "EUR",
                toAmount: 86,
            });
            expect(typeof res.body.transaction.id).toBe("string");
            expect(await balanceOf("USD")).toBe(900);
            expect(await balanceOf("EUR")).toBe(86);
        });

        it("guarda la cotización usada y la descripción en el movimiento", async () => {
            const browser = await loggedInBrowser();

            await exchange(browser, "USD", "COP", 10).expect(201);

            const { rows } = await pool.query(
                "SELECT rate::text, fee_amount::text, description FROM transactions WHERE type = 'exchange'"
            );
            expect(rows[0]).toEqual({
                rate: "3800.000000000000",
                fee_amount: "0.00",
                description: "Intercambio",
            });
        });

        it("trunca lo recibido a 2 decimales, nunca redondea hacia arriba", async () => {
            const browser = await loggedInBrowser();
            await deposit(browser, "EUR", 10);

            // 1 EUR = 1 / 0,86 = 1,162790697674 USD. 10 EUR = 11,6279... USD:
            // redondeando serían 11,63; truncando, 11,62.
            const res = await exchange(browser, "EUR", "USD", 10);

            expect(res.status).toBe(201);
            expect(res.body.transaction.toAmount).toBe(11.62);
            expect(await balanceOf("USD")).toBe(1011.62);

            // amount_from x rate guardada, truncado, da exactamente amount_to.
            const { rows } = await pool.query(
                `SELECT rate::text, TRUNC(amount_from * rate, 2) = amount_to AS verifiable
                 FROM transactions WHERE type = 'exchange'`
            );
            expect(rows[0]).toEqual({ rate: "1.162790697674", verifiable: true });
        });

        it("acepta los códigos en minúsculas", async () => {
            const browser = await loggedInBrowser();

            const res = await exchange(browser, "usd", " ars ", 1);

            expect(res.status).toBe(201);
            expect(res.body.balances).toEqual([
                { currency: "USD", amount: 999 },
                { currency: "ARS", amount: 1600 },
            ]);
        });

        it("permite intercambiar todo el saldo (queda en 0)", async () => {
            const browser = await loggedInBrowser();

            const res = await exchange(browser, "USD", "ARS", 1000);

            expect(res.status).toBe(201);
            expect(await balanceOf("USD")).toBe(0);
            expect(await balanceOf("ARS")).toBe(1_600_000);
        });

        it("el intercambio aparece en el summary", async () => {
            const browser = await loggedInBrowser();
            await exchange(browser, "USD", "EUR", 50).expect(201);

            const summary = await browser.get("/api/wallet/summary");

            expect(summary.body.balances).toContainEqual({ currency: "USD", amount: 950 });
            expect(summary.body.balances).toContainEqual({ currency: "EUR", amount: 43 });
        });

        it("rechaza con 422 si no alcanza el saldo, sin tocar nada", async () => {
            const browser = await loggedInBrowser();

            const res = await exchange(browser, "USD", "EUR", 1000.01);

            expect(res.status).toBe(422);
            expect(res.body).toEqual({
                message: "No tenés saldo suficiente en USD para este intercambio",
            });
            expect(await balanceOf("USD")).toBe(1000);
            expect(await balanceOf("EUR")).toBe(0);
            expect(await exchangeCount()).toBe(0);
        });

        it("rechaza con 422 un monto que convertido da 0", async () => {
            const browser = await loggedInBrowser();
            await deposit(browser, "COP", 1);

            // 1 COP = 0,00026 USD: truncado a 2 decimales es 0.
            const res = await exchange(browser, "COP", "USD", 1);

            expect(res.status).toBe(422);
            expect(res.body).toEqual({ message: "El monto es demasiado chico para convertirlo a USD" });
            expect(await balanceOf("COP")).toBe(1);
            expect(await exchangeCount()).toBe(0);
        });

        it("rechaza con 400 dos monedas iguales", async () => {
            const browser = await loggedInBrowser();

            const res = await exchange(browser, "USD", "usd", 10);

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ message: "Elegí dos monedas distintas" });
        });

        it.each([
            ["origen", { fromCurrency: "dolar", toCurrency: "EUR" }, "Indicá una moneda de origen válida (ARS, COP, EUR o USD)"],
            ["origen", { toCurrency: "EUR" }, "Indicá una moneda de origen válida (ARS, COP, EUR o USD)"],
            ["destino", { fromCurrency: "USD", toCurrency: 12 }, "Indicá una moneda de destino válida (ARS, COP, EUR o USD)"],
        ])("rechaza con 400 una moneda de %s inválida", async (_caso, currencies, message) => {
            const browser = await loggedInBrowser();

            const res = await browser.post("/api/exchange").send({ ...currencies, amount: 10 });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ message });
        });

        it.each([
            ["cero", 0],
            ["negativo", -50],
            ["más de 2 decimales", 10.555],
            ["texto", "100"],
            ["ausente", undefined],
        ])("rechaza con 400 un monto %s", async (_caso, amount) => {
            const browser = await loggedInBrowser();

            const res = await exchange(browser, "USD", "EUR", amount);

            expect(res.status).toBe(400);
            expect(res.body).toEqual({
                message: "El monto tiene que ser un número mayor a 0 con hasta 2 decimales",
            });
        });

        it("rechaza con 400 una moneda que Jetty no maneja", async () => {
            const browser = await loggedInBrowser();

            const res = await exchange(browser, "USD", "BTC", 10);

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ message: "No se puede intercambiar entre USD y BTC" });
            expect(await balanceOf("USD")).toBe(1000);
        });

        it("rechaza con 400 una moneda deshabilitada", async () => {
            const browser = await loggedInBrowser();
            // resetDatabase no restaura el catálogo de monedas: se vuelve a activar al final.
            await pool.query("UPDATE currencies SET is_active = FALSE WHERE code = 'COP'");

            try {
                const res = await exchange(browser, "USD", "COP", 10);

                expect(res.status).toBe(400);
                expect(await exchangeCount()).toBe(0);
            } finally {
                await pool.query("UPDATE currencies SET is_active = TRUE WHERE code = 'COP'");
            }
        });

        it("dos intercambios simultáneos que juntos superan el saldo: solo pasa uno", async () => {
            const browser = await loggedInBrowser();

            const responses = await Promise.all([
                exchange(browser, "USD", "EUR", 600),
                exchange(browser, "USD", "EUR", 600),
            ]);

            expect(responses.map((res) => res.status).sort()).toEqual([201, 422]);
            expect(await balanceOf("USD")).toBe(400);
            expect(await balanceOf("EUR")).toBe(516);
            expect(await exchangeCount()).toBe(1);
        });

        it("intercambios simultáneos en sentidos opuestos no se traban (sin deadlock)", async () => {
            const browser = await loggedInBrowser();
            await deposit(browser, "EUR", 500);

            const responses = await Promise.all(
                Array.from({ length: 6 }, (_, i) =>
                    i % 2 === 0
                        ? exchange(browser, "USD", "EUR", 10)
                        : exchange(browser, "EUR", "USD", 10)
                )
            );

            expect(responses.every((res) => res.status === 201)).toBe(true);
            expect(await exchangeCount()).toBe(6);
            // 3 x (-10 USD +8,60 EUR) y 3 x (-10 EUR +11,62 USD)
            expect(await balanceOf("USD")).toBe(1004.86);
            expect(await balanceOf("EUR")).toBe(495.8);
        });

        it("si falla el registro del movimiento, los saldos vuelven atrás (rollback)", async () => {
            const browser = await loggedInBrowser();
            // Restricción temporal que hace fallar el INSERT del intercambio,
            // después del débito y el crédito.
            await pool.query(
                "ALTER TABLE transactions ADD CONSTRAINT test_block_exchange CHECK (type <> 'exchange') NOT VALID"
            );

            try {
                const res = await exchange(browser, "USD", "EUR", 100);

                expect(res.status).toBe(500);
                expect(await balanceOf("USD")).toBe(1000);
                expect(await balanceOf("EUR")).toBe(0);
            } finally {
                await pool.query("ALTER TABLE transactions DROP CONSTRAINT test_block_exchange");
            }
        });

        it("si el usuario de la sesión ya no existe responde 401", async () => {
            const browser = await loggedInBrowser();
            await pool.query("TRUNCATE transactions, balances, wallets, users CASCADE");

            const res = await exchange(browser, "USD", "EUR", 10);

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ message: "Token inválido o vencido" });
        });
    });

    it("con cotizaciones vencidas que no se pueden renovar, usa las guardadas", async () => {
        await seedRates(RATES, new Date(Date.now() - 2 * HOUR_MS));
        const browser = await loggedInBrowser();

        const res = await exchange(browser, "USD", "EUR", 100);

        expect(res.status).toBe(201);
        expect(res.body.transaction.toAmount).toBe(86);
    });

    it("sin ninguna cotización responde 503 y no toca los saldos", async () => {
        const browser = await loggedInBrowser();

        const res = await exchange(browser, "USD", "EUR", 100);

        expect(res.status).toBe(503);
        expect(await balanceOf("USD")).toBe(1000);
        expect(await exchangeCount()).toBe(0);
    });
});
