/*  Búsqueda de usuarios por email contra PostgreSQL real.
    Se saltean si no hay DATABASE_URL_TEST configurada. */

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import { closeDatabase, hasTestDatabase, resetDatabase } from "../helpers/db";

const ana = { name: "Ana Pérez", email: "ana@mail.com", password: "12345678" };
const bruno = { name: "Bruno Gil", email: "bruno@mail.com", password: "12345678" };

const loginAs = async (user: typeof ana) => {
    await request(app).post("/api/auth/register").send(user);
    const res = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: user.password });
    return res.body.token as string;
};

describe.skipIf(!hasTestDatabase)("GET /api/users/lookup", () => {
    beforeEach(resetDatabase);
    afterAll(closeDatabase);

    it("con un email existente devuelve solo nombre y email", async () => {
        const token = await loginAs(ana);
        await request(app).post("/api/auth/register").send(bruno);

        const res = await request(app)
            .get("/api/users/lookup")
            .query({ email: bruno.email })
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ name: "Bruno Gil", email: "bruno@mail.com" });
    });

    it("normaliza el email buscado", async () => {
        const token = await loginAs(ana);
        await request(app).post("/api/auth/register").send(bruno);

        const res = await request(app)
            .get("/api/users/lookup")
            .query({ email: "  BRUNO@mail.com " })
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    it("con un email inexistente responde 404", async () => {
        const token = await loginAs(ana);

        const res = await request(app)
            .get("/api/users/lookup")
            .query({ email: "nadie@mail.com" })
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ message: "No existe un usuario con ese email" });
    });

    it("buscar el propio email responde 400", async () => {
        const token = await loginAs(ana);

        const res = await request(app)
            .get("/api/users/lookup")
            .query({ email: ana.email })
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: "No podés transferirte a vos mismo" });
    });

    it("sin email en la consulta responde 400", async () => {
        const token = await loginAs(ana);

        const res = await request(app)
            .get("/api/users/lookup")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
    });

    it("sin token responde 401", async () => {
        const res = await request(app)
            .get("/api/users/lookup")
            .query({ email: bruno.email });

        expect(res.status).toBe(401);
    });
});
