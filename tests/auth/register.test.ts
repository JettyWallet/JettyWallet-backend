/*  Registro de usuarios contra PostgreSQL real.
    Se saltean si no hay DATABASE_URL_TEST configurada. */

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import { closeDatabase, hasTestDatabase, pool, resetDatabase } from "../helpers/db";

const validUser = {
    name: "Ana Pérez",
    email: "ana@mail.com",
    password: "12345678",
};

describe.skipIf(!hasTestDatabase)("POST /api/auth/register", () => {
    beforeEach(resetDatabase);
    afterAll(closeDatabase);

    it("crea el usuario y su billetera", async () => {
        const res = await request(app).post("/api/auth/register").send(validUser);

        expect(res.status).toBe(201);
        // Solo el usuario, con la misma forma que login y /me. El token va en la cookie.
        expect(res.body).toEqual({
            user: { id: expect.any(String), name: "Ana Pérez", email: "ana@mail.com" },
        });

        const { rows } = await pool.query(
            `SELECT u.account_number, w.id AS wallet_id
             FROM users u JOIN wallets w ON w.user_id = u.id
             WHERE u.id = $1`,
            [res.body.user.id]
        );

        expect(rows).toHaveLength(1);
        expect(rows[0].account_number).toMatch(/^[0-9]{8}$/);
    });

    it("guarda el email normalizado (sin espacios y en minúsculas)", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({ ...validUser, email: "  Ana@Mail.COM " });

        expect(res.status).toBe(201);
        expect(res.body.user.email).toBe("ana@mail.com");
    });

    it("rechaza datos inválidos con 400", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({ ...validUser, password: "corta" });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/al menos 8 caracteres/);
    });

    it("rechaza un email ya registrado con 409", async () => {
        await request(app).post("/api/auth/register").send(validUser);

        const res = await request(app)
            .post("/api/auth/register")
            .send({ ...validUser, email: "ANA@mail.com" });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ message: "El email ya está registrado" });
    });

    it("con dos registros simultáneos del mismo email, solo uno se crea", async () => {
        const [first, second] = await Promise.all([
            request(app).post("/api/auth/register").send(validUser),
            request(app).post("/api/auth/register").send(validUser),
        ]);

        expect([first.status, second.status].sort()).toEqual([201, 409]);

        const { rows } = await pool.query("SELECT COUNT(*)::int AS total FROM wallets");
        expect(rows[0].total).toBe(1);
    });
});
