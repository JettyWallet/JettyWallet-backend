/*  GET /api/transactions.
    El caso sin sesión no necesita base de datos; el resto se saltea
    si no hay DATABASE_URL_TEST configurada. */

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import { closeDatabase, hasTestDatabase, pool, resetDatabase } from "../helpers/db";
import { seedRates } from "../helpers/rates";

const ana = { name: "Ana Pérez", email: "ana@mail.com", password: "12345678" };
const beto = { name: "Beto Gómez", email: "beto@mail.com", password: "12345678" };

// "Navegador" con la sesión ya iniciada. Arranca con el depósito de bienvenida.
const loggedInBrowser = async (user = ana) => {
    const browser = request.agent(app);
    await browser.post("/api/auth/register").send(user).expect(201);
    return browser;
};

type Browser = Awaited<ReturnType<typeof loggedInBrowser>>;

const walletIdOf = async (email: string): Promise<string> => {
    const { rows } = await pool.query<{ id: string }>(
        "SELECT w.id FROM wallets w JOIN users u ON u.id = w.user_id WHERE u.email = $1",
        [email]
    );
    return rows[0].id;
};

// Inserta depósitos directo en la base, con la fecha que se indique,
// para probar el orden y la paginación sin depender del reloj.
const insertDeposits = async (
    email: string,
    dates: string[],
    currency = "USD"
): Promise<string[]> => {
    const walletId = await walletIdOf(email);
    const ids: string[] = [];
    for (const date of dates) {
        const { rows } = await pool.query<{ id: string }>(
            `INSERT INTO transactions (wallet_id, type, currency_to, amount_to, description, created_at)
             VALUES ($1, 'deposit', $2, 1, 'Depósito', $3) RETURNING id`,
            [walletId, currency, date]
        );
        ids.push(rows[0].id);
    }
    return ids;
};

// N fechas de un minuto en el pasado, una por segundo.
const pastDates = (n: number): string[] =>
    Array.from({ length: n }, (_, i) => new Date(Date.now() - 60_000 - i * 1000).toISOString());

// Recorre todas las páginas con before, como haría el botón "Cargar más".
const fetchAllPages = async (browser: Browser, query: string) => {
    const pages: { id: string }[][] = [];
    let before: string | undefined;
    for (;;) {
        const url = `/api/transactions?${query}${before ? `&before=${before}` : ""}`;
        const res = await browser.get(url).expect(200);
        pages.push(res.body);
        if (res.body.length === 0 || pages.length > 50) break;
        before = res.body[res.body.length - 1].id;
    }
    return pages;
};

describe("GET /api/transactions sin base de datos", () => {
    it("sin sesión responde 401", async () => {
        const res = await request(app).get("/api/transactions");

        expect(res.status).toBe(401);
    });
});

describe.skipIf(!hasTestDatabase)("GET /api/transactions", () => {
    beforeEach(resetDatabase);
    afterAll(closeDatabase);

    it("un usuario nuevo tiene solo el depósito de bienvenida, con su descripción", async () => {
        const browser = await loggedInBrowser();

        const res = await browser.get("/api/transactions");

        expect(res.status).toBe(200);
        expect(res.body).toEqual([
            {
                id: expect.any(String),
                type: "deposit",
                fromCurrency: null,
                fromAmount: null,
                toCurrency: "USD",
                toAmount: 1000,
                description: "Saldo de bienvenida",
                createdAt: expect.any(String),
            },
        ]);
    });

    it("devuelve los movimientos más recientes primero", async () => {
        await seedRates({ EUR: 0.86, COP: 3800, ARS: 1600 });
        const browser = await loggedInBrowser();
        await browser.post("/api/deposits").send({ currency: "ARS", amount: 500 }).expect(201);
        await browser
            .post("/api/exchange")
            .send({ fromCurrency: "USD", toCurrency: "EUR", amount: 100 })
            .expect(201);

        const res = await browser.get("/api/transactions");

        expect(res.body.map((t: { description: string }) => t.description)).toEqual([
            "Intercambio",
            "Depósito",
            "Saldo de bienvenida",
        ]);
        expect(res.body[0]).toMatchObject({
            type: "exchange",
            fromCurrency: "USD",
            fromAmount: 100,
            toCurrency: "EUR",
            toAmount: 86,
        });
    });

    it("sin limit devuelve como máximo 20", async () => {
        const browser = await loggedInBrowser();
        await insertDeposits(ana.email, pastDates(25));

        const res = await browser.get("/api/transactions");

        expect(res.body).toHaveLength(20);
    });

    it("respeta limit (como pide el dashboard: ?limit=5)", async () => {
        const browser = await loggedInBrowser();
        await insertDeposits(ana.email, pastDates(10));

        const res = await browser.get("/api/transactions?limit=5");

        expect(res.body).toHaveLength(5);
    });

    it("paginando con before se recorren todos, sin repetidos ni faltantes", async () => {
        const browser = await loggedInBrowser();
        await insertDeposits(ana.email, pastDates(24));
        const { rows: all } = await pool.query<{ id: string }>(
            "SELECT id FROM transactions ORDER BY created_at DESC, id DESC"
        );

        const pages = await fetchAllPages(browser, "limit=7");

        // 25 movimientos (24 + bienvenida) en páginas de 7: 7, 7, 7, 4 y una vacía.
        expect(pages.map((page) => page.length)).toEqual([7, 7, 7, 4, 0]);
        expect(pages.flat().map((t) => t.id)).toEqual(all.map((t) => t.id));
    });

    it("movimientos con la misma fecha se desempatan por id y no se pierden al paginar", async () => {
        const browser = await loggedInBrowser();
        const sameDate = new Date(Date.now() - 60_000).toISOString();
        const ids = await insertDeposits(ana.email, Array(5).fill(sameDate));

        const pages = await fetchAllPages(browser, "limit=2");
        const received = pages.flat().map((t) => t.id);

        expect(received).toHaveLength(6);
        expect(new Set(received).size).toBe(6);
        expect(received).toEqual(expect.arrayContaining(ids));
    });

    it("no saltea movimientos separados por microsegundos (mismo milisegundo)", async () => {
        const browser = await loggedInBrowser();
        await insertDeposits(ana.email, [
            "2026-01-01T10:00:00.000300Z",
            "2026-01-01T10:00:00.000200Z",
            "2026-01-01T10:00:00.000100Z",
        ]);

        const pages = await fetchAllPages(browser, "limit=1");

        expect(pages.flat()).toHaveLength(4);
    });

    it("cada usuario ve solo sus movimientos", async () => {
        const anaBrowser = await loggedInBrowser(ana);
        await loggedInBrowser(beto);
        await insertDeposits(beto.email, pastDates(3));

        const res = await anaBrowser.get("/api/transactions");

        expect(res.body).toHaveLength(1);
        expect(res.body[0].description).toBe("Saldo de bienvenida");
    });

    it("rechaza con 400 un before de otro usuario", async () => {
        const anaBrowser = await loggedInBrowser(ana);
        await loggedInBrowser(beto);
        const [betoMovement] = await insertDeposits(beto.email, pastDates(1));

        const res = await anaBrowser.get(`/api/transactions?before=${betoMovement}`);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: "El movimiento indicado en before no existe" });
    });

    it("rechaza con 400 un before que no existe", async () => {
        const browser = await loggedInBrowser();

        const res = await browser.get(
            "/api/transactions?before=00000000-0000-0000-0000-000000000000"
        );

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: "El movimiento indicado en before no existe" });
    });

    it("filtra por tipo", async () => {
        await seedRates({ EUR: 0.86, COP: 3800, ARS: 1600 });
        const browser = await loggedInBrowser();
        await browser
            .post("/api/exchange")
            .send({ fromCurrency: "USD", toCurrency: "EUR", amount: 100 })
            .expect(201);

        const res = await browser.get("/api/transactions?type=exchange");

        expect(res.body).toHaveLength(1);
        expect(res.body[0].type).toBe("exchange");
    });

    it("filtra por moneda: incluye los movimientos donde entra o sale", async () => {
        await seedRates({ EUR: 0.86, COP: 3800, ARS: 1600 });
        const browser = await loggedInBrowser();
        await browser.post("/api/deposits").send({ currency: "ARS", amount: 500 }).expect(201);
        await browser
            .post("/api/exchange")
            .send({ fromCurrency: "USD", toCurrency: "EUR", amount: 100 })
            .expect(201);

        const usd = await browser.get("/api/transactions?currency=usd");
        const ars = await browser.get("/api/transactions?currency=ARS");

        // USD: el intercambio (sale) y la bienvenida (entra).
        expect(usd.body.map((t: { description: string }) => t.description)).toEqual([
            "Intercambio",
            "Saldo de bienvenida",
        ]);
        expect(ars.body).toHaveLength(1);
    });

    it("los filtros se combinan con la paginación", async () => {
        const browser = await loggedInBrowser();
        await insertDeposits(ana.email, pastDates(5), "COP");
        await insertDeposits(ana.email, pastDates(5), "ARS");

        const pages = await fetchAllPages(browser, "limit=2&currency=COP");

        expect(pages.map((page) => page.length)).toEqual([2, 2, 1, 0]);
    });

    it.each([
        ["limit=0", "limit tiene que ser un número entero entre 1 y 100"],
        ["limit=101", "limit tiene que ser un número entero entre 1 y 100"],
        ["limit=abc", "limit tiene que ser un número entero entre 1 y 100"],
        ["limit=1.5", "limit tiene que ser un número entero entre 1 y 100"],
        ["limit=-3", "limit tiene que ser un número entero entre 1 y 100"],
        ["limit=5&limit=6", "limit tiene que ser un número entero entre 1 y 100"],
        ["before=abc", "before tiene que ser el id de un movimiento"],
        ["type=goal_deposit", "type tiene que ser uno de: deposit, exchange, transfer_in, transfer_out"],
        ["currency=dolar", "Indicá una moneda válida (ARS, COP, EUR o USD)"],
    ])("rechaza con 400 %s", async (query, message) => {
        const browser = await loggedInBrowser();

        const res = await browser.get(`/api/transactions?${query}`);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message });
    });

    it("si el usuario de la sesión ya no existe responde 401", async () => {
        const browser = await loggedInBrowser();
        await pool.query("TRUNCATE transactions, balances, wallets, users CASCADE");

        const res = await browser.get("/api/transactions");

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: "Token inválido o vencido" });
    });
});
