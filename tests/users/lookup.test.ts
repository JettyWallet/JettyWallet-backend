/*  Búsqueda de usuarios por email contra PostgreSQL real, con sesión por cookie.
    Se saltean si no hay DATABASE_URL_TEST configurada. */

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import { closeDatabase, hasTestDatabase, resetDatabase } from "../helpers/db";

const ana = { name: "Ana Pérez", email: "ana@mail.com", password: "12345678" };
const bruno = { name: "Bruno Gil", email: "bruno@mail.com", password: "12345678" };

// Agente que guarda la cookie de sesión, como un navegador.
const loggedInAgent = async (user: typeof ana) => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send(user);
    await agent.post("/api/auth/login").send({ email: user.email, password: user.password });
    return agent;
};

describe.skipIf(!hasTestDatabase)("GET /api/users/lookup", () => {
    beforeEach(resetDatabase);
    afterAll(closeDatabase);

    it("con un email existente devuelve solo nombre y email", async () => {
        const agent = await loggedInAgent(ana);
        await request(app).post("/api/auth/register").send(bruno);

        const res = await agent.get("/api/users/lookup").query({ email: bruno.email });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ name: "Bruno Gil", email: "bruno@mail.com" });
    });

    it("normaliza el email buscado", async () => {
        const agent = await loggedInAgent(ana);
        await request(app).post("/api/auth/register").send(bruno);

        const res = await agent.get("/api/users/lookup").query({ email: "  BRUNO@mail.com " });

        expect(res.status).toBe(200);
    });

    it("con un email inexistente responde 404", async () => {
        const agent = await loggedInAgent(ana);

        const res = await agent.get("/api/users/lookup").query({ email: "nadie@mail.com" });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ message: "No existe un usuario con ese email" });
    });

    it("buscar el propio email responde 400", async () => {
        const agent = await loggedInAgent(ana);

        const res = await agent.get("/api/users/lookup").query({ email: ana.email });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: "No podés transferirte a vos mismo" });
    });

    it("sin email en la consulta responde 400", async () => {
        const agent = await loggedInAgent(ana);

        const res = await agent.get("/api/users/lookup");

        expect(res.status).toBe(400);
    });

    it("sin sesión responde 401", async () => {
        const res = await request(app)
            .get("/api/users/lookup")
            .query({ email: bruno.email });

        expect(res.status).toBe(401);
    });

    it("con más de 20 búsquedas en un minuto responde 429 en la búsqueda 21", async () => {
        const agent = await loggedInAgent(ana);
        await request(app).post("/api/auth/register").send(bruno);

        for (let i = 0; i < 20; i++) {
            const ok = await agent.get("/api/users/lookup").query({ email: bruno.email });
            expect(ok.status).toBe(200);
        }

        const blocked = await agent.get("/api/users/lookup").query({ email: bruno.email });

        expect(blocked.status).toBe(429);
        expect(blocked.body).toEqual({ message: "Demasiadas búsquedas, probá en un minuto" });
    });
});
