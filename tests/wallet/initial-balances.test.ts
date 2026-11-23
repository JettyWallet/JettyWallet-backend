/*  Saldos iniciales de una billetera nueva.
    Se saltean si no hay DATABASE_URL_TEST configurada. */

import { PoolClient } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createInitialBalances } from "../../src/wallet/wallet.service";
import { closeDatabase, hasTestDatabase, pool, resetDatabase } from "../helpers/db";
import { createUserWithWallet } from "../helpers/factories";

// Ejecuta `fn` dentro de una transacción, como lo hace registerUser.
const inTransaction = async (
    fn: (client: PoolClient) => Promise<void>,
    { commit = true } = {}
): Promise<void> => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        await fn(client);
        await client.query(commit ? "COMMIT" : "ROLLBACK");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

describe.skipIf(!hasTestDatabase)("createInitialBalances", () => {
    beforeEach(resetDatabase);
    afterAll(closeDatabase);

    it("crea un saldo por moneda: 1.000 USD y el resto en 0", async () => {
        const { walletId } = await createUserWithWallet();

        await inTransaction((client) => createInitialBalances(client, walletId));

        const { rows } = await pool.query(
            `SELECT currency_code, amount
             FROM balances
             WHERE wallet_id = $1
             ORDER BY currency_code`,
            [walletId]
        );

        expect(rows).toEqual([
            { currency_code: "ARS", amount: "0.00" },
            { currency_code: "COP", amount: "0.00" },
            { currency_code: "EUR", amount: "0.00" },
            { currency_code: "USD", amount: "1000.00" },
        ]);
    });

    it("registra el depósito de bienvenida en el historial", async () => {
        const { walletId } = await createUserWithWallet();

        await inTransaction((client) => createInitialBalances(client, walletId));

        const { rows } = await pool.query(
            `SELECT type, currency_from, amount_from, currency_to, amount_to, description
             FROM transactions
             WHERE wallet_id = $1`,
            [walletId]
        );

        expect(rows).toEqual([
            {
                type: "deposit",
                currency_from: null,
                amount_from: null,
                currency_to: "USD",
                amount_to: "1000.00",
                description: "Saldo de bienvenida",
            },
        ]);
    });

    it("no deja nada guardado si la transacción se revierte", async () => {
        const { walletId } = await createUserWithWallet();

        await inTransaction(
            (client) => createInitialBalances(client, walletId),
            { commit: false }
        );

        const balances = await pool.query("SELECT 1 FROM balances WHERE wallet_id = $1", [walletId]);
        const transactions = await pool.query("SELECT 1 FROM transactions WHERE wallet_id = $1", [walletId]);

        expect(balances.rowCount).toBe(0);
        expect(transactions.rowCount).toBe(0);
    });

    it("solo crea saldos para las monedas activas", async () => {
        const { walletId } = await createUserWithWallet();
        await pool.query("UPDATE currencies SET is_active = FALSE WHERE code = 'COP'");

        try {
            await inTransaction((client) => createInitialBalances(client, walletId));

            const { rows } = await pool.query(
                "SELECT currency_code FROM balances WHERE wallet_id = $1 ORDER BY currency_code",
                [walletId]
            );

            expect(rows.map((row) => row.currency_code)).toEqual(["ARS", "EUR", "USD"]);
        } finally {
            await pool.query("UPDATE currencies SET is_active = TRUE WHERE code = 'COP'");
        }
    });

    it("falla si la billetera ya tenía saldos (se usa una sola vez)", async () => {
        const { walletId } = await createUserWithWallet();
        await inTransaction((client) => createInitialBalances(client, walletId));

        await expect(
            inTransaction((client) => createInitialBalances(client, walletId))
        ).rejects.toThrow(/balances_pkey/);
    });
});
